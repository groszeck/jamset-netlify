function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mediaQueryList = window.matchMedia(query)
    const handler = event => setMatches(event.matches)
    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener('change', handler)
    } else {
      mediaQueryList.addListener(handler)
    }
    return () => {
      if (mediaQueryList.removeEventListener) {
        mediaQueryList.removeEventListener('change', handler)
      } else {
        mediaQueryList.removeListener(handler)
      }
    }
  }, [query])

  return matches
}

const Sidebar = ({ menuItems }) => {
  const [isOpen, setIsOpen] = useState(false)
  const { user } = useAuth()
  const isMdUp = useMediaQuery('(min-width: 768px)')
  const visible = isOpen || isMdUp

  const toggleSidebar = () => setIsOpen(prev => !prev)
  const location = useLocation()

  return (
    <>
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
        aria-expanded={isOpen}
        aria-controls="sidebar"
        className="md:hidden p-2 focus:outline-none"
      >
        {isOpen ? (
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>
      {visible && (
        <aside
          id="sidebar"
          role="navigation"
          aria-label="Main menu"
          className={`fixed inset-y-0 left-0 bg-white shadow-lg w-64 transform transition-transform duration-200 ease-in-out z-20 ${
            isOpen || isMdUp ? 'translate-x-0' : '-translate-x-full'
          } md:static md:translate-x-0`}
        >
          <nav className="mt-8">
            {menuItems.map(item => {
              if (item.roles && (!user || !item.roles.includes(user.role))) {
                return null
              }
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end
                  className={({ isActive }) =>
                    `flex items-center px-4 py-2 mx-4 my-1 rounded hover:bg-gray-100 ${
                      isActive ? 'bg-gray-200 font-semibold' : 'font-medium'
                    }`
                  }
                  onClick={() => setIsOpen(false)}
                >
                  {item.icon && <item.icon className="w-5 h-5 mr-3" />}
                  {item.label}
                </NavLink>
              )
            })}
          </nav>
        </aside>
      )}
    </>
  )
}

Sidebar.propTypes = {
  menuItems: PropTypes.arrayOf(
    PropTypes.shape({
      to: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      icon: PropTypes.elementType,
      roles: PropTypes.arrayOf(PropTypes.string),
    })
  ),
}

Sidebar.defaultProps = {
  menuItems: [],
}

export default Sidebar