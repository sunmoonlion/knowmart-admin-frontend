// 供需市场的运营（SDD 0018 第十一节）：条目审核要写理由才能不通过；举报核实就下架
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ListingReview, ReportsScreen } from '@/components/market-admin/market-admin'
import messages from '@/messages/zh-CN.json'

type Call = { method: string; path: string; body: unknown }
let calls: Call[] = []

beforeEach(() => {
  calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init: RequestInit = {}) => {
      const path = String(input).split('?')[0]
      const method = init.method ?? 'GET'
      const json = (body: unknown, status = 200) =>
        new Response(status === 204 ? null : JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' },
        })
      if (method !== 'GET') {
        calls.push({ method, path, body: JSON.parse(String(init.body ?? 'null')) })
        return json(null, 204)
      }
      if (path.endsWith('/queue')) {
        return json({
          publishers: [],
          licenses: [],
          experts: [],
          knowledge: [
            {
              listing_id: 'l1',
              title: '2024 行业数据',
              category: { name: '信息查询' },
              price: '50.00',
              description: '稳赚的数据',
              items: [{ name: '行业数据.xlsx' }],
              sample: '',
              rights_statement: '自己整理',
              flagged: ['稳赚'],
            },
          ],
        })
      }
      if (path.endsWith('/reports')) {
        return json({
          items: [
            {
              report_id: 'r1',
              target_kind: 'knowledge',
              target_id: 'l1',
              reason: '有收益承诺',
              status: 'open',
              note: null,
            },
          ],
        })
      }
      return json({ code: 'not_found' }, 404)
    }),
  )
})

afterEach(() => vi.unstubAllGlobals())

function page(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="zh-CN" messages={messages} timeZone="Asia/Shanghai">
        {node}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  )
}

describe('供需市场的运营', () => {
  it('条目审核：标出禁止类词；不通过要写理由', async () => {
    page(<ListingReview csrfToken="csrf" />)
    const section = within(await screen.findByRole('region', { name: '知识条目' }))
    expect(await section.findByText('出现了禁止类的词：稳赚')).toBeInTheDocument()
    const reject = section.getByRole('button', { name: '不通过' })
    expect(reject).toBeDisabled()
    fireEvent.change(section.getByLabelText('说明'), { target: { value: '有收益承诺' } })
    fireEvent.click(reject)
    await waitFor(() =>
      expect(calls).toEqual([
        {
          method: 'POST',
          path: '/api/admin/v1/knowmart/market/knowledge/l1/decision',
          body: { approve: false, note: '有收益承诺' },
        },
      ]),
    )
  })

  it('举报：核实就下架', async () => {
    page(<ReportsScreen csrfToken="csrf" />)
    fireEvent.click(await screen.findByRole('button', { name: '核实，下架' }))
    await waitFor(() =>
      expect(calls[0]).toEqual({
        method: 'POST',
        path: '/api/admin/v1/knowmart/market/reports/r1/decision',
        body: { uphold: true, note: '' },
      }),
    )
  })
})
