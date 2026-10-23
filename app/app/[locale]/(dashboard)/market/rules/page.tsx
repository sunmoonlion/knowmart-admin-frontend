import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { RulesEditor } from '@/components/market-admin/market-admin'
import { requireAnyRole } from '@/lib/server/auth-session'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav')
  return { title: t('marketRules'), robots: { index: false, follow: false } }
}

// 供需市场的运营（SDD 0018 第十一节第 7 小节）：admin、operator 都能做
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const session = await requireAnyRole(locale, ['admin', 'operator'])
  const t = await getTranslations('marketAdmin')

  return (
    <div data-route-class="authenticated-workspace">
      <div className="admin-page-heading">
        <h1 className="text-2xl font-semibold tracking-tight">{t('rulesTitle')}</h1>
        <p className="text-muted-foreground mt-2">{t('rulesLead')}</p>
      </div>
      <div className="mt-6">
        <RulesEditor csrfToken={session.csrf_token} />
      </div>
    </div>
  )
}
