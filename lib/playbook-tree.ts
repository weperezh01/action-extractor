export interface PlaybookNode {
  id: string
  text: string
  children: PlaybookNode[]
}

export interface PlaybookPhase {
  id: number
  title: string
  items: PlaybookNode[]
}

export interface FlattenedPlaybookNode {
  nodeId: string
  parentNodeId: string | null
  depth: number
  path: string
  fullPath: string
  order: number
  text: string
}

function getNodeChildren(node: unknown): PlaybookNode[] {
  if (!node || typeof node !== 'object') return []
  const children = (node as { children?: unknown }).children
  return Array.isArray(children) ? (children as PlaybookNode[]) : []
}

function sanitizeNodeId(raw: unknown) {
  if (typeof raw !== 'string') return ''
  return raw.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9:_-]/g, '')
}

function normalizeNodeText(raw: unknown) {
  if (typeof raw !== 'string') return ''
  return raw.trim()
}

function makeFallbackNodeId(phaseId: number, pathSegments: number[]) {
  return `p${phaseId}-n${pathSegments.join('_')}`
}

function makeUniqueNodeId(baseId: string, usedIds: Set<string>) {
  let candidate = baseId || `n_${Math.random().toString(36).slice(2, 10)}`
  if (!usedIds.has(candidate)) {
    usedIds.add(candidate)
    return candidate
  }

  let suffix = 2
  while (usedIds.has(`${candidate}_${suffix}`)) {
    suffix += 1
  }
  candidate = `${candidate}_${suffix}`
  usedIds.add(candidate)
  return candidate
}

function parseRawChildren(raw: unknown) {
  if (!raw || typeof raw !== 'object') return []
  const rawChildren = (raw as { children?: unknown }).children
  if (Array.isArray(rawChildren)) return rawChildren
  const rawItems = (raw as { items?: unknown }).items
  if (Array.isArray(rawItems)) return rawItems
  return []
}

function parseRawText(raw: unknown) {
  if (typeof raw === 'string') return raw
  if (!raw || typeof raw !== 'object') return ''
  return (
    normalizeNodeText((raw as { text?: unknown }).text) ||
    normalizeNodeText((raw as { itemText?: unknown }).itemText) ||
    normalizeNodeText((raw as { item_text?: unknown }).item_text) ||
    normalizeNodeText((raw as { title?: unknown }).title) ||
    normalizeNodeText((raw as { item?: unknown }).item) ||
    normalizeNodeText((raw as { label?: unknown }).label) ||
    normalizeNodeText((raw as { content?: unknown }).content) ||
    normalizeNodeText((raw as { description?: unknown }).description) ||
    normalizeNodeText((raw as { name?: unknown }).name)
  )
}

function normalizeNodes(input: {
  rawItems: unknown[]
  phaseId: number
  pathPrefix: number[]
  usedIds: Set<string>
}): PlaybookNode[] {
  const nodes: PlaybookNode[] = []

  for (let index = 0; index < input.rawItems.length; index += 1) {
    const rawNode = input.rawItems[index]
    const pathSegments = [...input.pathPrefix, index + 1]
    const text = parseRawText(rawNode)
    const rawChildren = parseRawChildren(rawNode)
    const children = normalizeNodes({
      rawItems: rawChildren,
      phaseId: input.phaseId,
      pathPrefix: pathSegments,
      usedIds: input.usedIds,
    })

    const isObjectNode = rawNode !== null && typeof rawNode === 'object'
    const normalizedText =
      text.trim() || (isObjectNode || children.length > 0 ? `Ítem ${pathSegments.join('.')}` : '')
    if (!normalizedText) continue

    const preferredId =
      sanitizeNodeId((rawNode as { id?: unknown } | null)?.id) ||
      makeFallbackNodeId(input.phaseId, pathSegments)
    const id = makeUniqueNodeId(preferredId, input.usedIds)

    nodes.push({
      id,
      text: normalizedText,
      children,
    })
  }

  return nodes
}

export function normalizePlaybookPhases(payload: unknown): PlaybookPhase[] {
  if (!Array.isArray(payload)) return []

  const phases = payload
    .map((rawPhase, index) => {
      if (!rawPhase || typeof rawPhase !== 'object') return null
      const rawId = (rawPhase as { id?: unknown }).id
      const rawTitle = (rawPhase as { title?: unknown }).title
      const rawItems = (rawPhase as { items?: unknown }).items

      const idParsed = Number.parseInt(String(rawId ?? ''), 10)
      const phaseId = Number.isFinite(idParsed) && idParsed > 0 ? idParsed : index + 1
      const title =
        normalizeNodeText(rawTitle) || `Ítem principal ${index + 1}`
      const itemsRaw = Array.isArray(rawItems) ? rawItems : []
      const usedIds = new Set<string>()
      const items = normalizeNodes({
        rawItems: itemsRaw,
        phaseId,
        pathPrefix: [],
        usedIds,
      })

      return {
        id: phaseId,
        title,
        items,
      } satisfies PlaybookPhase
    })
    .filter((phase): phase is PlaybookPhase => Boolean(phase))

  return phases.map((phase, index) => ({
    ...phase,
    id: index + 1,
  }))
}

function flattenNodes(input: {
  phaseId: number
  nodes: PlaybookNode[]
  parentNodeId: string | null
  pathPrefix: number[]
  depth: number
  orderStart: number
}): FlattenedPlaybookNode[] {
  const rows: FlattenedPlaybookNode[] = []
  let order = input.orderStart

  for (let index = 0; index < input.nodes.length; index += 1) {
    const node = input.nodes[index]
    const children = getNodeChildren(node)
    const pathSegments = [...input.pathPrefix, index + 1]
    const path = pathSegments.join('.')
    const fullPath = `${input.phaseId}.${path}`
    rows.push({
      nodeId: node.id,
      parentNodeId: input.parentNodeId,
      depth: input.depth,
      path,
      fullPath,
      order,
      text: node.text,
    })
    order += 1

    if (children.length > 0) {
      const childRows = flattenNodes({
        phaseId: input.phaseId,
        nodes: children,
        parentNodeId: node.id,
        pathPrefix: pathSegments,
        depth: input.depth + 1,
        orderStart: order,
      })
      rows.push(...childRows)
      order += childRows.length
    }
  }

  return rows
}

export function flattenPhaseNodes(phaseId: number, items: PlaybookNode[]) {
  return flattenNodes({
    phaseId,
    nodes: items,
    parentNodeId: null,
    pathPrefix: [],
    depth: 1,
    orderStart: 0,
  })
}

export function flattenPlaybookPhases(phases: PlaybookPhase[]) {
  return phases.flatMap((phase) =>
    flattenPhaseNodes(phase.id, phase.items).map((node, index) => ({
      phaseId: phase.id,
      phaseTitle: phase.title,
      itemIndex: index,
      itemText: node.text,
      nodeId: node.nodeId,
      parentNodeId: node.parentNodeId,
      depth: node.depth,
      positionPath: node.fullPath,
    }))
  )
}

export function flattenItemsAsText(items: PlaybookNode[]) {
  const rows: string[] = []
  const walk = (nodes: PlaybookNode[], pathPrefix: number[]) => {
    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index]
      const children = getNodeChildren(node)
      const path = [...pathPrefix, index + 1].join('.')
      rows.push(`${path} ${node.text}`)
      if (children.length > 0) {
        walk(children, [...pathPrefix, index + 1])
      }
    }
  }
  walk(items, [])
  return rows
}

export function buildNewNode(label = 'Nuevo ítem'): PlaybookNode {
  const random = Math.random().toString(36).slice(2, 10)
  return {
    id: `n_${Date.now().toString(36)}_${random}`,
    text: label,
    children: [],
  }
}

export function updateNodeText(items: PlaybookNode[], nodeId: string, nextText: string): PlaybookNode[] {
  return items.map((node) => {
    const children = getNodeChildren(node)
    if (node.id === nodeId) {
      return { ...node, text: nextText }
    }
    if (children.length === 0) return node
    return {
      ...node,
      children: updateNodeText(children, nodeId, nextText),
    }
  })
}

export function addChildNode(items: PlaybookNode[], parentNodeId: string, node: PlaybookNode): PlaybookNode[] {
  return items.map((item) => {
    const children = getNodeChildren(item)
    if (item.id === parentNodeId) {
      return {
        ...item,
        children: [...children, node],
      }
    }
    if (children.length === 0) return item
    return {
      ...item,
      children: addChildNode(children, parentNodeId, node),
    }
  })
}

export function addSiblingNode(items: PlaybookNode[], siblingNodeId: string, node: PlaybookNode): PlaybookNode[] {
  const next: PlaybookNode[] = []
  for (const item of items) {
    const children = getNodeChildren(item)
    if (item.id === siblingNodeId) {
      next.push(item, node)
      continue
    }
    if (children.length > 0) {
      next.push({
        ...item,
        children: addSiblingNode(children, siblingNodeId, node),
      })
      continue
    }
    next.push(item)
  }
  return next
}

export function deleteNode(items: PlaybookNode[], nodeId: string): PlaybookNode[] {
  return items
    .filter((item) => item.id !== nodeId)
    .map((item) => ({
      ...item,
      children: deleteNode(getNodeChildren(item), nodeId),
    }))
}

export function findNode(items: PlaybookNode[], nodeId: string): PlaybookNode | null {
  for (const item of items) {
    if (item.id === nodeId) return item
    const child = findNode(getNodeChildren(item), nodeId)
    if (child) return child
  }
  return null
}

export function countNodes(items: PlaybookNode[]): number {
  return items.reduce((total, item) => total + 1 + countNodes(getNodeChildren(item)), 0)
}
