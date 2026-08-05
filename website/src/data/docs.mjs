export const docs = [
  { id: 'intro', header: true, zh: { title: '基础介绍', source: 'Flow2Spec基础介绍' }, en: { title: 'Introduction', source: 'en/Flow2Spec-Introduction' } },
  { id: 'usage', header: true, zh: { title: '使用说明', source: '使用说明' }, en: { title: 'Usage guide', source: 'en/usage-guide' } },
  { id: 'commands', header: true, zh: { title: '命令说明', source: '命令说明' }, en: { title: 'Commands', source: 'en/commands-reference' } },
  { id: 'architecture', header: true, zh: { title: '体系与原理', source: '体系与原理' }, en: { title: 'Architecture', source: 'en/architecture' } },
  { id: 'design', header: true, zh: { title: '设计说明', source: '设计说明' }, en: { title: 'Design', source: 'en/design-principles' } },
  { id: 'collaboration', header: true, zh: { title: '团队协作', source: '团队协作' }, en: { title: 'Collaboration', source: 'en/team-collaboration' } },
  { id: 'milestones', header: true, zh: { title: '项目里程碑', source: '项目里程碑' }, en: { title: 'Milestones', source: 'en/milestones' } },
  { id: 'directories', header: false, zh: { title: '目录与路径约定', source: '目录与路径约定' }, en: { title: 'Directory conventions', source: 'en/directory-conventions' } },
  { id: 'scenarios', header: false, zh: { title: '使用案例', source: '使用案例-模拟对话' }, en: { title: 'Usage scenarios', source: 'en/usage-scenarios' } }
];

export const headerDocs = docs.filter((doc) => doc.header);

export function docHref(doc, english, base = '/') {
  return `${base}${english ? 'en/' : ''}docs/${doc.id}/`;
}

export function findDocByMarkdownPath(pathname) {
  const cleanPath = decodeURI(pathname).replace(/\\/g, '/').replace(/\.md$/i, '');
  const basename = cleanPath.split('/').pop();
  for (const doc of docs) {
    if (doc.zh.source.split('/').pop() === basename) return { doc, english: false };
    if (doc.en.source.split('/').pop() === basename) return { doc, english: true };
  }
  return undefined;
}
