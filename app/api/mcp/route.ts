import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Project root — all file access is restricted to this directory
const PROJECT_ROOT = path.resolve(process.cwd())

// Directories/patterns excluded from all operations
const EXCLUDED_DIRS = new Set(['node_modules', '.next', '.git', '.turbo', 'dist', 'out', '.cache'])
const EXCLUDED_PATTERNS = [/^\.env/, /\.(key|pem|p12|pfx|crt|cer)$/i, /^\.DS_Store$/, /^Thumbs\.db$/i]

const MCP_PROTOCOL_VERSION = '2024-11-05'
const SERVER_NAME = 'action-extractor'
const SERVER_VERSION = '1.0.0'

// ─── Auth ────────────────────────────────────────────────────────────────────

function checkAuth(req: NextRequest): boolean {
  const apiKey = process.env.MCP_API_KEY
  if (!apiKey) return false // refuse all requests if key not configured
  // Accept Bearer token in Authorization header (Claude.ai)
  const authHeader = req.headers.get('authorization') ?? ''
  if (authHeader === `Bearer ${apiKey}`) return true
  // Accept ?api_key= query param (ChatGPT — no custom header support)
  const queryKey = req.nextUrl.searchParams.get('api_key') ?? ''
  return queryKey === apiKey
}

// ─── Path safety ─────────────────────────────────────────────────────────────

function safePath(relativePath: string): string | null {
  // Resolve against project root
  const resolved = path.resolve(PROJECT_ROOT, relativePath)
  // Must stay inside project root
  if (!resolved.startsWith(PROJECT_ROOT + path.sep) && resolved !== PROJECT_ROOT) return null
  // Split and check each segment against exclusion list
  const relative = path.relative(PROJECT_ROOT, resolved)
  const parts = relative.split(path.sep)
  for (const part of parts) {
    if (EXCLUDED_DIRS.has(part)) return null
    if (EXCLUDED_PATTERNS.some((rx) => rx.test(part))) return null
  }
  return resolved
}

function isExcluded(name: string): boolean {
  return EXCLUDED_DIRS.has(name) || EXCLUDED_PATTERNS.some((rx) => rx.test(name))
}

// ─── Tool implementations ────────────────────────────────────────────────────

function toolReadFile(args: Record<string, unknown>): { content: string } | { error: string } {
  const relPath = String(args.path ?? '')
  if (!relPath) return { error: 'path is required' }
  const abs = safePath(relPath)
  if (!abs) return { error: 'Access denied: path is outside project or excluded' }
  try {
    const stat = fs.statSync(abs)
    if (!stat.isFile()) return { error: 'Path is not a file' }
    if (stat.size > 1_000_000) return { error: 'File too large (>1 MB); use search_files to find specific content' }
    const content = fs.readFileSync(abs, 'utf8')
    return { content }
  } catch {
    return { error: 'File not found or unreadable' }
  }
}

interface DirEntry {
  name: string
  type: 'file' | 'directory'
  size?: number
}

function toolListDirectory(args: Record<string, unknown>): { entries: DirEntry[] } | { error: string } {
  const relPath = String(args.path ?? '.')
  const abs = safePath(relPath)
  if (!abs) return { error: 'Access denied: path is outside project or excluded' }
  try {
    const stat = fs.statSync(abs)
    if (!stat.isDirectory()) return { error: 'Path is not a directory' }
    const names = fs.readdirSync(abs)
    const entries: DirEntry[] = []
    for (const name of names) {
      if (isExcluded(name)) continue
      try {
        const childStat = fs.statSync(path.join(abs, name))
        entries.push({
          name,
          type: childStat.isDirectory() ? 'directory' : 'file',
          size: childStat.isFile() ? childStat.size : undefined,
        })
      } catch {
        // skip unreadable entries
      }
    }
    entries.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    return { entries }
  } catch {
    return { error: 'Directory not found or unreadable' }
  }
}

function buildTree(dir: string, prefix: string, depth: number, maxDepth: number): string[] {
  if (depth > maxDepth) return []
  const lines: string[] = []
  let names: string[]
  try {
    names = fs.readdirSync(dir)
  } catch {
    return lines
  }
  const filtered = names.filter((n) => !isExcluded(n)).sort((a, b) => {
    try {
      const aIsDir = fs.statSync(path.join(dir, a)).isDirectory()
      const bIsDir = fs.statSync(path.join(dir, b)).isDirectory()
      if (aIsDir !== bIsDir) return aIsDir ? -1 : 1
    } catch {
      // ignore
    }
    return a.localeCompare(b)
  })
  for (let i = 0; i < filtered.length; i++) {
    const name = filtered[i]
    const isLast = i === filtered.length - 1
    const connector = isLast ? '└── ' : '├── '
    const childPrefix = isLast ? prefix + '    ' : prefix + '│   '
    const abs = path.join(dir, name)
    try {
      const stat = fs.statSync(abs)
      lines.push(`${prefix}${connector}${name}${stat.isDirectory() ? '/' : ''}`)
      if (stat.isDirectory()) {
        lines.push(...buildTree(abs, childPrefix, depth + 1, maxDepth))
      }
    } catch {
      // skip
    }
  }
  return lines
}

function toolGetProjectTree(args: Record<string, unknown>): { tree: string } {
  const maxDepth = Math.min(Number(args.max_depth ?? 4), 6)
  const lines = [PROJECT_ROOT.split('/').pop() + '/']
  lines.push(...buildTree(PROJECT_ROOT, '', 0, maxDepth))
  return { tree: lines.join('\n') }
}

interface SearchMatch {
  file: string
  line: number
  content: string
}

function searchInDir(dir: string, query: string, results: SearchMatch[], limit: number): void {
  if (results.length >= limit) return
  let entries: string[]
  try {
    entries = fs.readdirSync(dir)
  } catch {
    return
  }
  for (const name of entries) {
    if (results.length >= limit) break
    if (isExcluded(name)) continue
    const abs = path.join(dir, name)
    let stat: fs.Stats
    try {
      stat = fs.statSync(abs)
    } catch {
      continue
    }
    if (stat.isDirectory()) {
      searchInDir(abs, query, results, limit)
    } else if (stat.isFile() && stat.size < 500_000) {
      try {
        const content = fs.readFileSync(abs, 'utf8')
        const lines = content.split('\n')
        const relFile = path.relative(PROJECT_ROOT, abs)
        const lowerQuery = query.toLowerCase()
        for (let i = 0; i < lines.length && results.length < limit; i++) {
          if (lines[i].toLowerCase().includes(lowerQuery)) {
            results.push({ file: relFile, line: i + 1, content: lines[i].trimEnd() })
          }
        }
      } catch {
        // skip binary or unreadable files
      }
    }
  }
}

function toolSearchFiles(args: Record<string, unknown>): { matches: SearchMatch[]; truncated: boolean } | { error: string } {
  const query = String(args.query ?? '').trim()
  if (!query) return { error: 'query is required' }
  const relPath = String(args.path ?? '.')
  const abs = safePath(relPath)
  if (!abs) return { error: 'Access denied: path is outside project or excluded' }
  const limit = Math.min(Number(args.limit ?? 50), 200)
  const matches: SearchMatch[] = []
  try {
    const stat = fs.statSync(abs)
    if (stat.isDirectory()) {
      searchInDir(abs, query, matches, limit)
    } else if (stat.isFile()) {
      const content = fs.readFileSync(abs, 'utf8')
      const lines = content.split('\n')
      const lowerQuery = query.toLowerCase()
      for (let i = 0; i < lines.length && matches.length < limit; i++) {
        if (lines[i].toLowerCase().includes(lowerQuery)) {
          matches.push({ file: path.relative(PROJECT_ROOT, abs), line: i + 1, content: lines[i].trimEnd() })
        }
      }
    }
  } catch {
    return { error: 'Path not found or unreadable' }
  }
  return { matches, truncated: matches.length >= limit }
}

interface FileInfo {
  path: string
  name: string
  extension: string
  size: number
  sizeHuman: string
  isDirectory: boolean
  createdAt: string
  modifiedAt: string
}

function toolGetFileInfo(args: Record<string, unknown>): { info: FileInfo } | { error: string } {
  const relPath = String(args.path ?? '')
  if (!relPath) return { error: 'path is required' }
  const abs = safePath(relPath)
  if (!abs) return { error: 'Access denied: path is outside project or excluded' }
  try {
    const stat = fs.statSync(abs)
    const name = path.basename(abs)
    const ext = path.extname(name)
    const size = stat.size
    const sizeHuman =
      size < 1024 ? `${size} B` : size < 1_048_576 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1_048_576).toFixed(2)} MB`
    return {
      info: {
        path: path.relative(PROJECT_ROOT, abs),
        name,
        extension: ext,
        size,
        sizeHuman,
        isDirectory: stat.isDirectory(),
        createdAt: stat.birthtime.toISOString(),
        modifiedAt: stat.mtime.toISOString(),
      },
    }
  } catch {
    return { error: 'Path not found or unreadable' }
  }
}

// ─── Tool registry ────────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'read_file',
    description: 'Read the full content of a file in the action-extractor project. Returns the raw text. Max 1 MB.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path from the project root (e.g. "lib/db.ts" or "app/page.tsx")' },
      },
      required: ['path'],
    },
  },
  {
    name: 'list_directory',
    description: 'List files and subdirectories inside a project directory. Excludes node_modules, .next, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path to list (default: "." for project root)' },
      },
      required: [],
    },
  },
  {
    name: 'get_project_tree',
    description: 'Get a visual tree of the entire project structure (excludes node_modules, .next, etc.).',
    inputSchema: {
      type: 'object',
      properties: {
        max_depth: { type: 'number', description: 'Maximum depth to traverse (1-6, default 4)' },
      },
      required: [],
    },
  },
  {
    name: 'search_files',
    description: 'Search for a text string across all project files (case-insensitive). Returns file paths, line numbers, and matching lines.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Text to search for (case-insensitive)' },
        path: { type: 'string', description: 'Restrict search to this subdirectory or file (default: "." for all files)' },
        limit: { type: 'number', description: 'Maximum number of matches to return (default 50, max 200)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_file_info',
    description: 'Get metadata for a file or directory: size, extension, created/modified timestamps.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path from the project root' },
      },
      required: ['path'],
    },
  },
]

// ─── JSON-RPC helpers ─────────────────────────────────────────────────────────

function jsonRpcSuccess(id: unknown, result: unknown) {
  return NextResponse.json({ jsonrpc: '2.0', id, result })
}

function jsonRpcError(id: unknown, code: number, message: string) {
  return NextResponse.json({ jsonrpc: '2.0', id, error: { code, message } })
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Auth check
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { jsonrpc?: string; id?: unknown; method?: string; params?: unknown }
  try {
    body = await req.json()
  } catch {
    return jsonRpcError(null, -32700, 'Parse error')
  }

  const { id, method, params } = body

  if (body.jsonrpc !== '2.0' || typeof method !== 'string') {
    return jsonRpcError(id ?? null, -32600, 'Invalid Request')
  }

  // ── initialize ──────────────────────────────────────────────────────────────
  if (method === 'initialize') {
    return jsonRpcSuccess(id, {
      protocolVersion: MCP_PROTOCOL_VERSION,
      serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
      capabilities: { tools: {} },
    })
  }

  // ── notifications/initialized (client ack, no response needed) ──────────────
  if (method === 'notifications/initialized') {
    return new NextResponse(null, { status: 204 })
  }

  // ── tools/list ──────────────────────────────────────────────────────────────
  if (method === 'tools/list') {
    return jsonRpcSuccess(id, { tools: TOOLS })
  }

  // ── tools/call ──────────────────────────────────────────────────────────────
  if (method === 'tools/call') {
    const p = params as { name?: string; arguments?: Record<string, unknown> } | undefined
    const toolName = p?.name
    const toolArgs = p?.arguments ?? {}

    if (!toolName) return jsonRpcError(id, -32602, 'Missing tool name')

    let toolResult: unknown
    switch (toolName) {
      case 'read_file':
        toolResult = toolReadFile(toolArgs)
        break
      case 'list_directory':
        toolResult = toolListDirectory(toolArgs)
        break
      case 'get_project_tree':
        toolResult = toolGetProjectTree(toolArgs)
        break
      case 'search_files':
        toolResult = toolSearchFiles(toolArgs)
        break
      case 'get_file_info':
        toolResult = toolGetFileInfo(toolArgs)
        break
      default:
        return jsonRpcError(id, -32601, `Unknown tool: ${toolName}`)
    }

    const hasError = toolResult !== null && typeof toolResult === 'object' && 'error' in toolResult
    return jsonRpcSuccess(id, {
      content: [{ type: 'text', text: JSON.stringify(toolResult, null, 2) }],
      isError: hasError,
    })
  }

  // ── Unknown method ──────────────────────────────────────────────────────────
  return jsonRpcError(id, -32601, `Method not found: ${method}`)
}

// MCP clients may issue GET to check connectivity
export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({
    server: SERVER_NAME,
    version: SERVER_VERSION,
    protocol: MCP_PROTOCOL_VERSION,
    transport: 'http',
    tools: TOOLS.map((t) => t.name),
  })
}
