export const site = { name: '刘成的个人博客', englishName: 'KelyCrane', nickname: '斜方肌战神', description: '这里存放着我的所见所想。记录，是为了抵抗遗忘。', author: '刘成', email: '2905238085@qq.com', wechat: 'LJC_2905238085', readyToPublish: true };
export const href = (path = '') => `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
export const dateLabel = (date: Date) => new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Shanghai' }).format(date);
