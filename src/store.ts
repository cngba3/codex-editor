export type Project = {
  id: string
  title: string
  createdAt: number
  mode: 'preset' | 'reference'
  style: string
  notes: string
  rawName: string
  referenceName?: string
  raw: Blob
  reference?: Blob
  supporting?: { name: string; blob: Blob }[]
  duration: number
  size: number
}

const DATABASE = 'frameflow-studio'
const STORE = 'projects'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function listProjects(): Promise<Project[]> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE, 'readonly').objectStore(STORE).getAll()
    request.onsuccess = () => { database.close(); resolve((request.result as Project[]).sort((a, b) => b.createdAt - a.createdAt)) }
    request.onerror = () => { database.close(); reject(request.error) }
  })
}

export async function saveProject(project: Project): Promise<void> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readwrite')
    transaction.objectStore(STORE).put(project)
    transaction.oncomplete = () => { database.close(); resolve() }
    transaction.onerror = () => { database.close(); reject(transaction.error) }
  })
}

export async function deleteProject(id: string): Promise<void> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readwrite')
    transaction.objectStore(STORE).delete(id)
    transaction.oncomplete = () => { database.close(); resolve() }
    transaction.onerror = () => { database.close(); reject(transaction.error) }
  })
}
