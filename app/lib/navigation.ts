import {
  BadgeCheck,
  ChartNoAxesCombined,
  ClipboardCheck,
  Flag,
  Gauge,
  Receipt,
  ScrollText,
  Settings,
  TableProperties,
  type LucideIcon,
} from 'lucide-react'

export type AdminNavigationItem = {
  key: string
  path: string
  labelKey:
    | 'dashboard'
    | 'reference'
    | 'richReference'
    | 'settings'
    | 'marketListings'
    | 'marketQualifications'
    | 'marketReports'
    | 'marketRules'
    | 'marketTrades'
  icon: LucideIcon
  requiredRoles?: readonly string[]
  pinned?: boolean
}

export const adminNavigation: readonly AdminNavigationItem[] = [
  {
    key: 'dashboard',
    path: '/dashboard',
    labelKey: 'dashboard',
    icon: Gauge,
    pinned: true,
  },
  // 供需市场的运营（SDD 0018 第十一节第 7 小节）
  {
    key: 'market-listings',
    path: '/market/listings',
    labelKey: 'marketListings',
    icon: ClipboardCheck,
    requiredRoles: ['admin', 'operator'],
  },
  {
    key: 'market-qualifications',
    path: '/market/qualifications',
    labelKey: 'marketQualifications',
    icon: BadgeCheck,
    requiredRoles: ['admin', 'operator'],
  },
  {
    key: 'market-reports',
    path: '/market/reports',
    labelKey: 'marketReports',
    icon: Flag,
    requiredRoles: ['admin', 'operator'],
  },
  {
    key: 'market-rules',
    path: '/market/rules',
    labelKey: 'marketRules',
    icon: ScrollText,
    requiredRoles: ['admin', 'operator'],
  },
  {
    key: 'market-trades',
    path: '/market/trades',
    labelKey: 'marketTrades',
    icon: Receipt,
    requiredRoles: ['admin', 'operator'],
  },
  {
    key: 'reference',
    path: '/reference',
    labelKey: 'reference',
    icon: TableProperties,
    requiredRoles: ['admin', 'operator'],
  },
  {
    key: 'rich-reference',
    path: '/rich-reference',
    labelKey: 'richReference',
    icon: ChartNoAxesCombined,
    requiredRoles: ['admin'],
  },
  {
    key: 'settings',
    path: '/settings',
    labelKey: 'settings',
    icon: Settings,
  },
]

export function filterNavigationByRoles(
  roles: readonly string[],
  items: readonly AdminNavigationItem[] = adminNavigation,
) {
  const roleSet = new Set(roles)
  return items.filter(
    (item) => !item.requiredRoles || item.requiredRoles.some((role) => roleSet.has(role)),
  )
}

export function findNavigationItem(pathname: string) {
  const pathWithoutLocale = pathname.replace(/^\/(?:en|zh-CN)(?=\/|$)/, '') || '/'
  return adminNavigation.find(
    (item) =>
      pathWithoutLocale === item.path ||
      (item.path !== '/dashboard' && pathWithoutLocale.startsWith(`${item.path}/`)),
  )
}
