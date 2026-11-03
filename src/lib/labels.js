// 列舉值 → 繁體中文顯示標籤（專有名詞保留英文）

export const RATING = {
  'Strong Buy': { zh: '強力買進', tone: 'up-strong' },
  Buy: { zh: '買進', tone: 'up' },
  Hold: { zh: '持有', tone: 'neutral' },
  Trim: { zh: '減碼', tone: 'down' },
};
export const RATING_ORDER = ['Strong Buy', 'Buy', 'Hold', 'Trim'];

export const IMPACT = {
  Bullish: '利多',
  Bearish: '利空',
  Neutral: '中立',
  Binary: '雙向',
};

export const DIRECTION = { Bullish: '多頭', Bearish: '空頭', Neutral: '中性' };

export const SCENARIO = {
  bear: { zh: '悲觀', en: 'Bear' },
  base: { zh: '基準合理價', en: 'Base' },
  bull: { zh: '樂觀', en: 'Bull' },
};

export const KEY_LEVEL = {
  MajorResistance: { zh: '強壓力', en: 'Major Resistance', side: 'resistance' },
  SecondaryResistance: { zh: '次壓力', en: 'Secondary Resistance', side: 'resistance' },
  Pivot: { zh: '突破頸線', en: 'Pivot / Breakout', side: 'pivot' },
  SecondarySupport: { zh: '次支撐', en: 'Secondary Support', side: 'support' },
  StrongSupport: { zh: '強支撐', en: 'Strong Support', side: 'support' },
};
export const KEY_LEVEL_ORDER = ['MajorResistance', 'SecondaryResistance', 'Pivot', 'SecondarySupport', 'StrongSupport'];

export const MOAT_RATING = { Wide: '寬護城河 Wide', Narrow: '窄護城河 Narrow', None: '無護城河 None' };
export const MOAT_TYPE = {
  IntangibleAssets: '無形資產',
  SwitchingCosts: '轉換成本',
  NetworkEffects: '網路效應',
  CostAdvantage: '成本優勢',
  EfficientScale: '有效規模',
  TechnologyLeadership: '技術領先',
};

export const BEAT_MISS = { Beat: '優於預期 Beat', Miss: '低於預期 Miss', InLine: '符合預期 In-line' };
export const OUTLOOK_CHANGE = { Raised: '上調', Maintained: '維持', Lowered: '下調', Initiated: '首次提出' };
export const VS_CONSENSUS = { Above: '高於共識', InLine: '符合共識', Below: '低於共識', NA: '共識不可得' };

export const MOMENTUM = { Accelerating: '加速', Growing: '成長', Stable: '持平', Declining: '衰退' };
export const LEVEL3 = { High: '高', Medium: '中', Low: '低' };

export const NEWS_TYPE = {
  News: '新聞',
  '8-K': 'SEC 8-K',
  EarningsCall: '財報會議',
  AnalystAction: '分析師動作',
  Product: '產品／策略',
  'M&A': '併購',
  Macro: '總經',
  Index: '指數',
  Filing: 'SEC 申報',
};

export const CATALYST_CATEGORY = {
  Earnings: '財報',
  Conference: '展會／大會',
  Product: '產品',
  CustomerCapEx: '客戶 CapEx',
  Macro: '總經',
  Regulatory: '監管／併購',
  Corporate: '公司事件',
  Index: '指數',
};

export const BENCH_ROLE = { Market: '大盤', Growth: '科技成長', Sector: '產業 ETF', Peer: '同業' };
export const RSI_STATE = { Overbought: '超買', Neutral: '中性', Oversold: '超賣' };
export const MACD_STATE = { BullishCross: '黃金交叉', BearishCross: '死亡交叉', Bullish: '多方', Bearish: '空方', Neutral: '中性' };
export const HOLDER_ACTION = { Increased: '加碼', Decreased: '減碼', New: '新進', Exited: '出清', Unchanged: '不變', Holding: '持有' };
export const INSIDER_TYPE = { Buy: '買進', Sell: '賣出', OptionExercise: '履約', TaxWithholding: '代扣稅', Gift: '贈與' };
export const NET_ACTIVITY = { NetBuy: '淨買進', NetSell: '淨賣出', Neutral: '中性' };
export const SHORT_TREND = { Rising: '上升', Falling: '下降', Flat: '持平' };
export const GAMMA_TYPE = { CallWall: 'Call Wall', PutWall: 'Put Wall', GammaFlip: 'Gamma Flip' };
export const GAMMA_REGIME = { Positive: '正 Gamma（波動收斂）', Negative: '負 Gamma（波動放大）', Neutral: '中性' };

export const ZONE = {
  cheap: { zh: '便宜區', tone: 'up' },
  'below-fair': { zh: '低於合理區', tone: 'up' },
  fair: { zh: '合理區', tone: 'neutral' },
  'above-fair': { zh: '高於合理區', tone: 'down' },
  expensive: { zh: '昂貴區', tone: 'down' },
};
