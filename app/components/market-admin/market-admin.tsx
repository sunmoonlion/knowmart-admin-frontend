'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { ApiClientError, requestJson } from '@/lib/api/client'

// 供需市场的运营（SDD 0018 第十一节第 7 小节）：条目审核、资质审核、举报处理、驻场规则、成交记录
const base = '/api/admin/v1/knowmart/market'
const seg = encodeURIComponent
const loose = z.record(z.string(), z.any())
const queueSchema = z
  .object({
    publishers: z.array(loose),
    licenses: z.array(loose),
    knowledge: z.array(loose),
    experts: z.array(loose),
  })
  .loose()
type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const QUEUE = ['admin', 'market', 'queue'] as const
const fetchQueue = async () => queueSchema.parse(await requestJson(`${base}/queue`))
const decide = (
  csrfToken: string,
  kind: string,
  id: string,
  body: { approve: boolean; note: string },
) => requestJson(`${base}/${kind}/${seg(id)}/decision`, { method: 'POST', csrfToken, body })

function problem(error: unknown): string | null {
  if (!error) return null
  return error instanceof ApiClientError ? error.problem.code : 'failed'
}

function Flagged({ words }: { words: string[] | undefined }) {
  const t = useTranslations('marketAdmin')
  if (!words?.length) return null
  return (
    <p className="text-xs text-red-700 dark:text-red-300">
      {t('flagged', { words: words.join('、') })}
    </p>
  )
}

// 一条待审的：通过，或写理由不通过
function Decision({
  onDecide,
  busy,
}: {
  onDecide: (approve: boolean, note: string) => void
  busy: boolean
}) {
  const t = useTranslations('marketAdmin')
  const [note, setNote] = useState('')
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        className="min-w-60 flex-1 rounded-md border px-2 py-1 text-sm"
        aria-label={t('note')}
        placeholder={t('notePlaceholder')}
        value={note}
        maxLength={2000}
        onChange={(event) => setNote(event.target.value)}
      />
      <Button size="sm" disabled={busy} onClick={() => onDecide(true, note)}>
        {t('approve')}
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={busy || !note.trim()}
        onClick={() => onDecide(false, note)}
      >
        {t('reject')}
      </Button>
    </div>
  )
}

function useDecide(csrfToken: string, kind: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string; approve: boolean; note: string }) =>
      decide(csrfToken, kind, input.id, { approve: input.approve, note: input.note }),
    onSuccess: () => client.invalidateQueries({ queryKey: QUEUE }),
  })
}

function Section({
  title,
  empty,
  children,
}: {
  title: string
  empty: boolean
  children: React.ReactNode
}) {
  const t = useTranslations('marketAdmin')
  return (
    <section className="space-y-3" aria-label={title}>
      <h2 className="font-semibold">{title}</h2>
      {empty ? (
        <p className="text-muted-foreground text-sm">{t('nothing')}</p>
      ) : (
        <ul className="space-y-3">{children}</ul>
      )}
    </section>
  )
}

// 条目审核：知识条目、申请公开的专家（带标出的禁止类词）
export function ListingReview({ csrfToken }: { csrfToken: string }) {
  const t = useTranslations('marketAdmin')
  const queue = useQuery({ queryKey: QUEUE, queryFn: fetchQueue })
  const knowledge = useDecide(csrfToken, 'knowledge')
  const experts = useDecide(csrfToken, 'experts')
  const code = problem(queue.error ?? knowledge.error ?? experts.error)
  return (
    <div className="space-y-8">
      {code ? (
        <p role="alert" className="text-destructive text-sm">
          {t('problem', { code })}
        </p>
      ) : null}
      <Section title={t('knowledge')} empty={!queue.data?.knowledge.length}>
        {(queue.data?.knowledge ?? []).map((item: Row) => (
          <li key={item.listing_id} className="space-y-2 rounded-lg border p-4 text-sm">
            <p className="font-medium">
              {item.title} · {item.category?.name} ·{' '}
              {item.price === null ? t('free') : `¥${item.price}`}
            </p>
            <p className="whitespace-pre-wrap">{item.description}</p>
            <p className="text-muted-foreground text-xs">
              {t('files', { names: (item.items ?? []).map((i: Row) => i.name).join('、') })}
            </p>
            {item.sample ? (
              <pre className="bg-muted rounded p-2 text-xs whitespace-pre-wrap">{item.sample}</pre>
            ) : null}
            <p className="text-xs">{t('rights', { text: item.rights_statement })}</p>
            <Flagged words={item.flagged} />
            <Decision
              busy={knowledge.isPending}
              onDecide={(approve, note) => knowledge.mutate({ id: item.listing_id, approve, note })}
            />
          </li>
        ))}
      </Section>
      <Section title={t('experts')} empty={!queue.data?.experts.length}>
        {(queue.data?.experts ?? []).map((bot: Row) => (
          <li key={bot.knowbot_id} className="space-y-2 rounded-lg border p-4 text-sm">
            <p className="font-medium">
              {bot.name} · {bot.category?.name} · {bot.price === null ? t('free') : `¥${bot.price}`}
            </p>
            <Flagged words={bot.flagged} />
            <Decision
              busy={experts.isPending}
              onDecide={(approve, note) => experts.mutate({ id: bot.knowbot_id, approve, note })}
            />
          </li>
        ))}
      </Section>
    </div>
  )
}

// 资质审核：发布主体（实名材料、照片）、证照
export function QualificationReview({ csrfToken }: { csrfToken: string }) {
  const t = useTranslations('marketAdmin')
  const queue = useQuery({ queryKey: QUEUE, queryFn: fetchQueue })
  const publishers = useDecide(csrfToken, 'publishers')
  const licenses = useDecide(csrfToken, 'licenses')
  const code = problem(queue.error ?? publishers.error ?? licenses.error)
  return (
    <div className="space-y-8">
      {code ? (
        <p role="alert" className="text-destructive text-sm">
          {t('problem', { code })}
        </p>
      ) : null}
      <Section title={t('publishers')} empty={!queue.data?.publishers.length}>
        {(queue.data?.publishers ?? []).map((p: Row) => (
          <li key={p.publisher_id} className="space-y-2 rounded-lg border p-4 text-sm">
            <p className="font-medium">
              {p.name} · {t(`kind.${p.kind}`)}
            </p>
            {p.kind === 'individual' ? (
              <p>
                {t('individual', { name: p.real_name ?? '', masked: p.id_number_masked ?? '' })}
              </p>
            ) : (
              <p>
                {t('organization', {
                  code: p.credit_code ?? '',
                  legal: p.legal_person ?? '',
                  contact: p.contact_name ?? '',
                })}
              </p>
            )}
            <ul className="flex flex-wrap gap-3 text-xs">
              {(p.documents ?? []).map((d: Row) => (
                <li key={d.document_id}>
                  {d.purged ? (
                    t('purged')
                  ) : (
                    <a
                      className="underline"
                      href={`${base}/documents/${seg(d.document_id)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t(`document.${d.kind}`)}
                    </a>
                  )}
                </li>
              ))}
            </ul>
            <Decision
              busy={publishers.isPending}
              onDecide={(approve, note) => publishers.mutate({ id: p.publisher_id, approve, note })}
            />
          </li>
        ))}
      </Section>
      <Section title={t('licenses')} empty={!queue.data?.licenses.length}>
        {(queue.data?.licenses ?? []).map((lic: Row) => (
          <li key={lic.license_id} className="space-y-2 rounded-lg border p-4 text-sm">
            <p className="font-medium">
              {lic.category?.name} · {lic.license_name} · {lic.license_no}
            </p>
            <p className="text-xs">{t('validUntil', { date: lic.valid_until ?? t('forever') })}</p>
            {lic.document_id ? (
              <a
                className="text-xs underline"
                href={`${base}/documents/${seg(lic.document_id)}`}
                target="_blank"
                rel="noreferrer"
              >
                {t('document.license')}
              </a>
            ) : null}
            <Decision
              busy={licenses.isPending}
              onDecide={(approve, note) => licenses.mutate({ id: lic.license_id, approve, note })}
            />
          </li>
        ))}
      </Section>
    </div>
  )
}

// 举报处理：核实就下架（知识买家那份照旧在；专家下架后不能再请），不核实就驳回
export function ReportsScreen({ csrfToken }: { csrfToken: string }) {
  const t = useTranslations('marketAdmin')
  const client = useQueryClient()
  const [status, setStatus] = useState<'open' | 'upheld' | 'dismissed'>('open')
  const reports = useQuery({
    queryKey: ['admin', 'market', 'reports', status] as const,
    queryFn: async () =>
      z
        .object({ items: z.array(loose) })
        .loose()
        .parse(await requestJson(`${base}/reports?status=${status}`)),
  })
  const [notes, setNotes] = useState<Record<string, string>>({})
  const handle = useMutation({
    mutationFn: (input: { id: string; uphold: boolean }) =>
      requestJson(`${base}/reports/${seg(input.id)}/decision`, {
        method: 'POST',
        csrfToken,
        body: { uphold: input.uphold, note: notes[input.id] ?? '' },
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['admin', 'market', 'reports'] }),
  })
  const code = problem(reports.error ?? handle.error)
  return (
    <div className="space-y-4">
      <div className="flex gap-2" role="group" aria-label={t('reportStatus')}>
        {(['open', 'upheld', 'dismissed'] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={status === s ? 'default' : 'outline'}
            onClick={() => setStatus(s)}
          >
            {t(`report.${s}`)}
          </Button>
        ))}
      </div>
      {code ? (
        <p role="alert" className="text-destructive text-sm">
          {t('problem', { code })}
        </p>
      ) : null}
      {reports.data && reports.data.items.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('nothing')}</p>
      ) : null}
      <ul className="space-y-3">
        {(reports.data?.items ?? []).map((r: Row) => (
          <li key={r.report_id} className="space-y-2 rounded-lg border p-4 text-sm">
            <p className="font-medium">
              {t(`target.${r.target_kind}`)} ·{' '}
              <span className="font-mono text-xs">{r.target_id}</span>
            </p>
            <p className="whitespace-pre-wrap">{r.reason}</p>
            {r.note ? (
              <p className="text-muted-foreground text-xs">{t('handledNote', { note: r.note })}</p>
            ) : null}
            {r.status === 'open' ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="min-w-60 flex-1 rounded-md border px-2 py-1 text-sm"
                  aria-label={t('note')}
                  value={notes[r.report_id] ?? ''}
                  onChange={(event) => setNotes({ ...notes, [r.report_id]: event.target.value })}
                />
                <Button
                  size="sm"
                  disabled={handle.isPending}
                  onClick={() => handle.mutate({ id: r.report_id, uphold: true })}
                >
                  {t('uphold')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={handle.isPending}
                  onClick={() => handle.mutate({ id: r.report_id, uphold: false })}
                >
                  {t('dismiss')}
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

// 驻场规则：改文字出一个新版本，旧的留着
export function RulesEditor({ csrfToken }: { csrfToken: string }) {
  const t = useTranslations('marketAdmin')
  const client = useQueryClient()
  const rules = useQuery({
    queryKey: ['admin', 'market', 'rules'] as const,
    queryFn: async () =>
      z
        .object({ version: z.number(), body: z.string() })
        .loose()
        .parse(await requestJson(`${base}/rules`)),
  })
  const [draft, setDraft] = useState<string | null>(null)
  const body = draft ?? rules.data?.body ?? ''
  const save = useMutation({
    mutationFn: () => requestJson(`${base}/rules`, { method: 'PUT', csrfToken, body: { body } }),
    onSuccess: () => {
      setDraft(null)
      void client.invalidateQueries({ queryKey: ['admin', 'market', 'rules'] })
    },
  })
  const code = problem(rules.error ?? save.error)
  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">
        {t('rulesVersion', { version: rules.data?.version ?? 0 })}
      </p>
      <textarea
        className="min-h-96 w-full rounded-md border p-3 font-mono text-sm"
        aria-label={t('rulesBody')}
        value={body}
        onChange={(event) => setDraft(event.target.value)}
      />
      <Button
        size="sm"
        disabled={save.isPending || draft === null || !body.trim()}
        onClick={() => save.mutate()}
      >
        {t('publishRules')}
      </Button>
      {save.isSuccess ? (
        <p role="status" className="text-sm">
          {t('rulesPublished')}
        </p>
      ) : null}
      {code ? (
        <p role="alert" className="text-destructive text-sm">
          {t('problem', { code })}
        </p>
      ) : null}
    </div>
  )
}

// 成交记录：本期只记、不收钱
export function TradesScreen() {
  const t = useTranslations('marketAdmin')
  const [page, setPage] = useState(1)
  const trades = useQuery({
    queryKey: ['admin', 'market', 'trades', page] as const,
    queryFn: async () =>
      z
        .object({ items: z.array(loose) })
        .loose()
        .parse(await requestJson(`${base}/trades?page=${page}`)),
  })
  return (
    <div className="space-y-3">
      {trades.data && trades.data.items.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('nothing')}</p>
      ) : null}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted-foreground text-left text-xs">
            <th className="py-2">{t('tradeTitle')}</th>
            <th>{t('tradeKind')}</th>
            <th>{t('tradePrice')}</th>
            <th>{t('tradeInto')}</th>
            <th>{t('tradeAt')}</th>
          </tr>
        </thead>
        <tbody>
          {(trades.data?.items ?? []).map((trade: Row) => (
            <tr key={trade.trade_id} className="border-t">
              <td className="py-2">{trade.title}</td>
              <td>{t(`target.${trade.kind}`)}</td>
              <td>{trade.price === null ? t('free') : `¥${trade.price}`}</td>
              <td>{trade.target_app ?? '—'}</td>
              <td className="text-xs">{trade.created_at?.slice(0, 16).replace('T', ' ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          {t('prev')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={(trades.data?.items.length ?? 0) < 96}
          onClick={() => setPage(page + 1)}
        >
          {t('next')}
        </Button>
      </div>
    </div>
  )
}
