export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const { user, signOut } = useAuth()

  const handleLogout = async () => {
    setLogoutError('')
    try {
      await signOut()
    } catch (error) {
      setLogoutError('Failed to log out. Please try again.')
      console.error('Logout failed', error)
    }
  }

  const baseItems = [
    { to: '/', label: 'Home' },
    { to: '/library', label: 'Library' },
    { to: '/concerts', label: 'Concerts' },
    { to: '/chat', label: 'Chat' },
    { to: '/calendar', label: 'Calendar' }
  ]

  const authItems = user
    ? [
        { to: '/settings', label: 'Settings' },
        { action: handleLogout, label: 'Logout' }
      ]
    : [{ to: '/login', label: 'Login' }]

  const desktopItems = [
    ...baseItems,
    ...(user && user.role === 'admin' ? [{ to: '/admin', label: 'Admin' }] : []),
    ...authItems
  ]

  return (
    <nav aria-label="Primary navigation" className="bg-white shadow-md fixed inset-x-0 top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex-shrink-0 flex items-center">
            <Link to="/" title="SetMaster Home">
              <img className="h-8 w-auto" src="/logo.png" alt="SetMaster Logo" />
            </Link>
          </div>
          <div className="hidden md:flex md:items-center md:space-x-4">
            {desktopItems.map((item, idx) =>
              item.to ? (
                <Link key={idx} to={item.to} className="px-3 py-2 text-gray-800 hover:text-indigo-600">
                  {item.label}
                </Link>
              ) : (
                <button key={idx} onClick={item.action} className="px-3 py-2 text-gray-800 hover:text-indigo-600">
                  {item.label}
                </button>
              )
            )}
          </div>
          <div className="flex items-center md:hidden">
            <button
              onClick={() => setMenuOpen(open => !open)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-800 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-expanded={menuOpen}
              aria-label="Toggle navigation menu"
            >
              {menuOpen ? (
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
      {logoutError && (
        <div className="bg-red-100 text-red-700 text-center p-2">
          {logoutError}
        </div>
      )}
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {baseItems.map((item, idx) => (
              <Link
                key={idx}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2 text-gray-800 hover:text-indigo-600"
              >
                {item.label}
              </Link>
            ))}
            {user && user.role === 'admin' && (
              <Link
                to="/admin"
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2 text-gray-800 hover:text-indigo-600"
              >
                Admin
              </Link>
            )}
            {authItems.map((item, idx) =>
              item.to ? (
                <Link
                  key={`auth-${idx}`}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2 text-gray-800 hover:text-indigo-600"
                >
                  {item.label}
                </Link>
              ) : (
                <button
                  key={`auth-${idx}`}
                  onClick={() => {
                    setMenuOpen(false)
                    item.action()
                  }}
                  className="w-full text-left px-3 py-2 text-gray-800 hover:text-indigo-600"
                >
                  {item.label}
                </button>
              )
            )}
          </div>
        </div>
      )}
    </nav>
  )
}