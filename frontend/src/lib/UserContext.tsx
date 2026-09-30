import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, getUserEmail, setUserEmail, type User } from '../api'

interface UserState {
  users: User[]
  user: User | null
  // Changing user changes what the backend shows (company/country visibility), so pages re-fetch on `version`.
  version: number
  switchUser: (email: string) => void
}

const UserContext = createContext<UserState>({ users: [], user: null, version: 0, switchUser: () => {} })

export function UserProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>([])
  const [email, setEmail] = useState(getUserEmail())
  const [version, setVersion] = useState(0)

  useEffect(() => {
    api
      .users()
      .then((list) => {
        setUsers(list)
        if (!list.some((u) => u.email === getUserEmail()) && list.length) {
          const fallback = list.find((u) => u.seeAll) ?? list[0]
          setUserEmail(fallback.email)
          setEmail(fallback.email)
          setVersion((v) => v + 1)
        }
      })
      .catch(() => setUsers([]))
  }, [])

  const switchUser = (next: string) => {
    setUserEmail(next)
    setEmail(next)
    setVersion((v) => v + 1)
  }

  const user = users.find((u) => u.email === email) ?? null
  return <UserContext.Provider value={{ users, user, version, switchUser }}>{children}</UserContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUser() {
  return useContext(UserContext)
}
