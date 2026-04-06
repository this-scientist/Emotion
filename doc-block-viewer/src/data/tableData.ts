/** 咨询师意图列表（来自 xlsx） */
export interface IntentItem {
  id: number
  name: string
  meaning: string
}

/** 助人技术列表（来自 xlsx，含细分类型） */
export interface TechItem {
  id: number          // 主编号（细分条目共用父编号）
  subId: string       // 显示用编号，如 "3a" "3b"
  name: string        // 技术名称
  subType: string     // 细分类型（"-" 表示无细分）
  meaning: string
}

export const INTENTS: IntentItem[] = [
  { id: 1,  name: '设限',           meaning: '明确咨询边界、规则或时间框架，保障咨询安全有序' },
  { id: 2,  name: '获得信息',       meaning: '主动收集来访者背景、问题、经历等关键资料' },
  { id: 3,  name: '提供信息',       meaning: '向来访者分享知识、资源或客观事实，辅助理解与决策' },
  { id: 4,  name: '支持',           meaning: '给予情感接纳、鼓励，增强来访者面对问题的信心' },
  { id: 5,  name: '聚焦',           meaning: '将对话收拢到核心问题或目标，避免话题发散' },
  { id: 6,  name: '澄清',           meaning: '梳理来访者模糊的想法、感受或事件，让表达更清晰具体' },
  { id: 7,  name: '灌输希望',       meaning: '传递积极预期，让来访者相信改变的可能性，提升动力' },
  { id: 8,  name: '鼓励宣泄',       meaning: '引导来访者安全表达压抑情绪，释放心理负担' },
  { id: 9,  name: '辨别适应不良的认知', meaning: '识别并指出来访者不合理、自我挫败的思维模式' },
  { id: 10, name: '辨别适应不良的行为', meaning: '识别并指出来访者阻碍成长、加剧问题的行为模式' },
  { id: 11, name: '鼓励自我控制',   meaning: '引导来访者学习管理情绪、冲动，提升自主调节能力' },
  { id: 12, name: '辨别并强化感受', meaning: '帮助来访者觉察、命名情绪，并给予肯定与接纳' },
  { id: 13, name: '促进领悟',       meaning: '推动来访者理解问题根源、模式与意义，实现认知突破' },
  { id: 14, name: '促进改变',       meaning: '引导来访者尝试新的思维、情绪或行为方式' },
  { id: 15, name: '强化改变',       meaning: '肯定、巩固来访者的进步与新的适应性模式，防止倒退' },
  { id: 16, name: '处理阻抗',       meaning: '识别并化解来访者的抗拒、回避或防御行为' },
  { id: 17, name: '挑战',           meaning: '温和地质疑来访者不合理的认知或行为，促使其反思调整' },
  { id: 18, name: '处理治疗关系',   meaning: '维护健康的咨访互动、信任与情感联结' },
  { id: 19, name: '缓解助人者的需求', meaning: '关注咨询师自身职业耗竭与情绪压力，保障专业状态' },
]

export const TECHS: TechItem[] = [
  { id: 1,  subId: '1',   name: '认可',        subType: '-',         meaning: '对来访者的感受、想法或行为给予肯定与接纳' },
  { id: 2,  subId: '2',   name: '封闭式提问',  subType: '-',         meaning: '用"是/否"或简短词语即可回答的问题，用于确认信息' },
  { id: 3,  subId: '3a',  name: '开放式提问',  subType: '针对想法',  meaning: '引导来访者深入表达思考、观念与认知' },
  { id: 3,  subId: '3b',  name: '开放式提问',  subType: '针对情感',  meaning: '引导来访者探索和表达情绪、感受' },
  { id: 3,  subId: '3c',  name: '开放式提问',  subType: '针对领悟',  meaning: '引导来访者反思问题的意义、关联与洞察' },
  { id: 3,  subId: '3d',  name: '开放式提问',  subType: '针对行动',  meaning: '引导来访者思考具体行为、选择与行动计划' },
  { id: 4,  subId: '4',   name: '重述',        subType: '-',         meaning: '简洁重复来访者核心内容，确认理解并鼓励继续表达' },
  { id: 5,  subId: '5',   name: '情感反映',    subType: '-',         meaning: '准确识别并反馈来访者情绪状态，传递共情与理解' },
  { id: 6,  subId: '6',   name: '挑战',        subType: '-',         meaning: '建设性指出来访者认知或行为中的矛盾、局限，促其反思' },
  { id: 7,  subId: '7',   name: '解释',        subType: '-',         meaning: '基于理论为来访者的问题、感受提供新的解读视角' },
  { id: 8,  subId: '8a',  name: '表露',        subType: '情感表露',  meaning: '咨询师适度分享自身情绪体验，拉近咨访距离' },
  { id: 8,  subId: '8b',  name: '表露',        subType: '领悟性表露', meaning: '咨询师分享对来访者问题的洞察与理解' },
  { id: 8,  subId: '8c',  name: '表露',        subType: '策略表露',  meaning: '咨询师分享咨询思路、方法或干预策略' },
  { id: 9,  subId: '9',   name: '即时化',      subType: '-',         meaning: '将对话聚焦于当下互动、感受或关系，处理"此时此刻"体验' },
  { id: 10, subId: '10a', name: '提供信息/反馈', subType: '助人过程信息', meaning: '向来访者解释咨询流程、目标与方法' },
  { id: 10, subId: '10b', name: '提供信息/反馈', subType: '事实/数据/观点', meaning: '分享客观知识或信息，辅助来访者决策' },
  { id: 10, subId: '10c', name: '提供信息/反馈', subType: '对当事人的反馈', meaning: '就来访者行为、模式或进步给予具体建设性回应' },
  { id: 11, subId: '11a', name: '建议/指导',   subType: '过程建议',  meaning: '就咨询推进方式、步骤给出建议' },
  { id: 11, subId: '11b', name: '建议/指导',   subType: '指导',      meaning: '直接给出具体行动步骤、方法或指令，引导改变' },
  { id: 12, subId: '12',  name: '其他',        subType: '-',         meaning: '未被上述分类涵盖的助人技术或互动方式' },
]

/** 将意图列表格式化为显示标签，如 "1.设限" */
export function intentLabel(item: IntentItem): string {
  return `${item.id}.${item.name}`
}

/** 将技术条目格式化为显示标签，如 "3a 开放式提问（针对想法）" */
export function techLabel(item: TechItem): string {
  const sub = item.subType !== '-' ? `（${item.subType}）` : ''
  return `${item.subId} ${item.name}${sub}`
}
