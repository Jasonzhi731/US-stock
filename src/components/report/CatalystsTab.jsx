import { useState } from 'react';
import { CalendarDays, CircleCheck, CircleDashed, ExternalLink, Gauge, Newspaper, Scale, TrendingDown, TrendingUp } from 'lucide-react';
import { Badge, BulletList, Card, CardHeader, ImpactBadge, LevelBadge, SectionTitle, cx } from '../ui.jsx';
import { Meter } from '../charts.jsx';
import { fmtDate } from '../../lib/format.js';
import { CATALYST_CATEGORY, IMPACT, NEWS_TYPE } from '../../lib/labels.js';

export default function CatalystsTab({ a }) {
  const nc = a.newsAndCatalysts;
  const sources = Object.fromEntries(a.meta.sources.map((s) => [s.id, s]));
  const [filter, setFilter] = useState('All');
  const news = nc.recentNews.filter((n) => filter === 'All' || n.impact === filter);
  const ss = nc.sentimentScore;

  return (
    <div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader icon={Gauge} title="市場情緒綜合評分" en="Sentiment Score" />
          <div className="p-4">
            <div className="flex items-end gap-2">
              <span className="num text-5xl font-semibold text-ink">{ss.score}</span>
              <span className="pb-1.5 text-sm text-ink-3">/ 100</span>
            </div>
            <div className="mt-1 text-sm text-ink-2">{ss.label}</div>
            <div className="mt-3"><Meter value={ss.score} label="市場情緒評分" /></div>
            <div className="num mt-1 flex justify-between text-[10px] text-ink-3"><span>0 極度悲觀</span><span>50</span><span>100 極度樂觀</span></div>
            <div className="mt-4 space-y-3">
              {ss.components.map((c) => (
                <div key={c.factor}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ink-2">{c.factor} <span className="text-ink-3">· 權重 {c.weightPct}%</span></span>
                    <span className="num font-semibold text-ink">{c.score}</span>
                  </div>
                  <div className="mt-1"><Meter value={c.score} label={c.factor} /></div>
                  {c.comment && <p className="mt-1 text-[11px] leading-relaxed text-ink-3">{c.comment}</p>}
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader icon={Scale} title="多空論點對決" en="Bull Case vs. Bear Case" />
          <div className="grid gap-px bg-line md:grid-cols-2">
            <div className="bg-surface p-4">
              <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-up"><TrendingUp className="h-4 w-4" aria-hidden />Bull Case 多方論點</div>
              <BulletList items={ss.bullCase} marker="up" />
            </div>
            <div className="bg-surface p-4">
              <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-down"><TrendingDown className="h-4 w-4" aria-hidden />Bear Case 空方論點</div>
              <BulletList items={ss.bearCase} marker="down" />
            </div>
          </div>
          <div className="border-t border-line bg-surface-2 p-4 text-sm leading-relaxed text-ink">
            <span className="mr-1 font-semibold text-accent">結論</span>
            {ss.verdict}
          </div>
        </Card>
      </div>

      <SectionTitle icon={CalendarDays} en="Catalyst Timeline · 未來 1–4 季">催化劑時間軸</SectionTitle>
      <Card className="p-4">
        <ol className="relative ml-2 border-l border-line">
          {nc.catalystTimeline.map((c, i) => (
            <li key={i} className="relative pb-5 pl-6 last:pb-0">
              <span className={cx('absolute -left-[9px] top-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-surface', c.dateConfirmed ? 'text-accent' : 'text-ink-3')}>
                {c.dateConfirmed ? <CircleCheck className="h-4 w-4" aria-label="日期已確認" /> : <CircleDashed className="h-4 w-4" aria-label="日期預估" />}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="num text-sm font-semibold text-ink">{fmtDate(c.date)}</span>
                <Badge tone={c.dateConfirmed ? 'accent' : 'neutral'}>{c.dateConfirmed ? '已確認' : '預估'}</Badge>
                <Badge tone="info">{CATALYST_CATEGORY[c.category]}</Badge>
                <LevelBadge level={c.importance} prefix="重要性 " />
                <Badge tone={c.expectedImpact === 'Bullish' ? 'up' : c.expectedImpact === 'Bearish' ? 'down' : c.expectedImpact === 'Binary' ? 'warn' : 'neutral'}>預期 {IMPACT[c.expectedImpact]}</Badge>
              </div>
              <div className="mt-1 text-sm font-medium text-ink">{c.event}</div>
              <div className="text-[11px] text-ink-3">{c.window}</div>
              <p className="mt-1 text-xs leading-relaxed text-ink-2">{c.description}</p>
            </li>
          ))}
        </ol>
      </Card>

      <SectionTitle icon={Newspaper} en="Recent News · 8-K · Earnings Call">近期重大消息</SectionTitle>
      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="消息影響篩選">
        {['All', 'Bullish', 'Bearish', 'Neutral'].map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            aria-pressed={filter === k}
            className={cx('rounded-md px-2.5 py-1.5 text-xs font-medium', filter === k ? 'bg-accent-soft text-accent ring-1 ring-accent/40' : 'text-ink-2 hover:bg-surface-2')}
          >
            {k === 'All' ? `全部 ${nc.recentNews.length}` : `${IMPACT[k]} ${nc.recentNews.filter((n) => n.impact === k).length}`}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {news.map((n, i) => (
          <Card key={i} as="article" className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="num text-xs text-ink-3">{fmtDate(n.date)}</span>
              <Badge>{NEWS_TYPE[n.type]}</Badge>
              <ImpactBadge impact={n.impact} />
            </div>
            <h3 className="mt-1.5 text-sm font-semibold text-ink">{n.headline}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-2">{n.summary}</p>
            <p className="mt-2 rounded-md bg-surface-2 px-3 py-2 text-xs leading-relaxed text-ink-2">
              <span className="font-medium text-ink">基本面影響　</span>
              {n.fundamentalImpact}
            </p>
            {n.sourceIds.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                {n.sourceIds.map((id) => sources[id] && (
                  <a key={id} href={sources[id].url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-[11px] text-ink-3 hover:text-accent">
                    <ExternalLink className="h-3 w-3" aria-hidden />[{id}] {sources[id].publisher}
                  </a>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
