import { describe, expect, it } from 'vitest'
import {
  addChildNode,
  addSiblingNode,
  buildNewNode,
  countNodes,
  deleteNode,
  flattenPhaseNodes,
  flattenPlaybookPhases,
  normalizePlaybookPhases,
  updateNodeText,
} from '@/lib/playbook-tree'

describe('lib/playbook-tree', () => {
  it('normaliza formato plano legado (items string[])', () => {
    const phases = normalizePlaybookPhases([
      { id: 4, title: 'Fase A', items: ['Uno', 'Dos'] },
    ])

    expect(phases).toHaveLength(1)
    expect(phases[0].id).toBe(1)
    expect(phases[0].items).toHaveLength(2)
    expect(phases[0].items[0].text).toBe('Uno')
    expect(phases[0].items[0].children).toEqual([])
  })

  it('normaliza árbol anidado y calcula flatten con rutas jerárquicas', () => {
    const phases = normalizePlaybookPhases([
      {
        id: 1,
        title: 'Fase',
        items: [
          {
            id: 'root',
            text: 'Padre',
            children: [{ id: 'child', text: 'Hijo', children: [] }],
          },
        ],
      },
    ])

    const flat = flattenPhaseNodes(phases[0].id, phases[0].items)
    expect(flat.map((node) => node.fullPath)).toEqual(['1.1', '1.1.1'])
    expect(flat.map((node) => node.depth)).toEqual([1, 2])
  })

  it('aplica operaciones de edición de nodos', () => {
    const phases = normalizePlaybookPhases([
      { id: 1, title: 'Fase', items: [{ id: 'a', text: 'A', children: [] }] },
    ])
    const root = phases[0].items[0]

    const withChild = addChildNode(phases[0].items, root.id, { id: 'b', text: 'B', children: [] })
    expect(withChild[0].children).toHaveLength(1)

    const withSibling = addSiblingNode(withChild, root.id, { id: 'c', text: 'C', children: [] })
    expect(withSibling).toHaveLength(2)

    const updated = updateNodeText(withSibling, 'c', 'C editado')
    expect(updated[1].text).toBe('C editado')

    const deleted = deleteNode(updated, 'c')
    expect(deleted).toHaveLength(1)
  })

  it('genera filas planas por fase para sincronización de tareas', () => {
    const nodeA = buildNewNode('A')
    const nodeB = buildNewNode('B')
    const phases = normalizePlaybookPhases([
      { id: 1, title: 'Fase 1', items: [nodeA, nodeB] },
    ])

    const rows = flattenPlaybookPhases(phases)
    expect(rows).toHaveLength(2)
    expect(rows[0].itemIndex).toBe(0)
    expect(rows[1].itemIndex).toBe(1)
    expect(rows[0].positionPath).toBe('1.1')
    expect(countNodes(phases[0].items)).toBe(2)
  })

  it('tolera nodos legacy sin children en flatten y edición', () => {
    const malformed = [{ id: 'legacy', text: 'Nodo legacy' }] as unknown as Parameters<typeof flattenPhaseNodes>[1]

    const flat = flattenPhaseNodes(1, malformed)
    expect(flat).toHaveLength(1)
    expect(flat[0].fullPath).toBe('1.1')

    const withChild = addChildNode(malformed, 'legacy', { id: 'child', text: 'Hijo', children: [] })
    expect(withChild[0].children).toHaveLength(1)
  })

  it('normaliza nodos legacy con itemText y fallback para objetos sin texto', () => {
    const phases = normalizePlaybookPhases([
      {
        id: 1,
        title: 'Fase',
        items: [
          { id: 'n1', itemText: 'Desde itemText' },
          { id: 'n2', children: [] },
        ],
      },
    ])

    expect(phases).toHaveLength(1)
    expect(phases[0].items).toHaveLength(2)
    expect(phases[0].items[0].text).toBe('Desde itemText')
    expect(phases[0].items[1].text).toBe('Ítem 2')
  })
})
