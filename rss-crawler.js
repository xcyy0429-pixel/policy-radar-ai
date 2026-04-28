const fs = require('fs');
const path = require('path');
const axios = require('axios');
const xml2js = require('xml2js');

const DATA_SOURCES = [
  {
    name: '深圳市科创委',
    source_id: 'stic',
    level: 'city',
    levelText: '市级',
    keywords: ['人工智能', '机器人', '智能', '科技', '数字', '算力', '大模型', '数据', '创新', '申报', '申请', '指南', '专项'],
    urls: [
      'https://stic.sz.gov.cn/xxgk/tzgg/',
      'https://stic.sz.gov.cn/xxgk/zdly/sbzn/',
      'https://stic.sz.gov.cn/xxgk/kjgh/'
    ]
  },
  {
    name: '深圳市工信局',
    source_id: 'gxj',
    level: 'city',
    levelText: '市级',
    keywords: ['人工智能', '机器人', '智能', '产业', '数字', '扶持', '补贴', '资助', '工业互联网', '制造'],
    urls: [
      'https://gxj.sz.gov.cn/xxgk/zcfg/zcfg/',
      'https://gxj.sz.gov.cn/xxgk/xxgkml/zcfgjzcjd/',
      'https://gxj.sz.gov.cn/xxgk/tzgg/'
    ]
  },
  {
    name: '中国政府网政策',
    source_id: 'gov',
    level: 'national',
    levelText: '国家级',
    keywords: ['人工智能', '机器人', '智能', '数字经济', '科技', '创新', '数据', '算力', '大模型'],
    urls: [
      'https://www.gov.cn/zhengce/zuixin/',
      'https://www.gov.cn/zhengce/kexue/'
    ]
  },
  {
    name: '工业和信息化部',
    source_id: 'miit',
    level: 'national',
    levelText: '国家级',
    keywords: ['人工智能', '机器人', '智能制造', '数字', '信息技术', '算力', '大模型', '工业互联网'],
    urls: [
      'https://www.miit.gov.cn/zwgk/zcwj/wjfb/',
      'https://www.miit.gov.cn/xwfb/bldhd/'
    ]
  },
  {
    name: '国家网信办',
    source_id: 'cac',
    level: 'national',
    levelText: '国家级',
    keywords: ['人工智能', '算法', '生成', '深度合成', '大模型', '数据', '智能'],
    urls: [
      'https://www.cac.gov.cn/zcfg.htm',
      'https://www.cac.gov.cn/xwdt/xwfb/'
    ]
  },
  {
    name: '科技部',
    source_id: 'most',
    level: 'national',
    levelText: '国家级',
    keywords: ['人工智能', '科技', '创新', '研发', '技术', '专项'],
    urls: [
      'https://www.most.gov.cn/ztzl/gjzcx/',
      'https://www.most.gov.cn/xwdt/gnsz/'
    ]
  },
  {
    name: '广东省科技厅',
    source_id: 'gdst',
    level: 'provincial',
    levelText: '省级',
    keywords: ['人工智能', '科技', '创新', '研发', '专项', '扶持'],
    urls: [
      'https://kjt.gd.gov.cn/xxgk/tzgg/'
    ]
  },
  {
    name: '深圳市政府',
    source_id: 'szgov',
    level: 'city',
    levelText: '市级',
    keywords: ['人工智能', '机器人', '智能', '科技', '数字', '扶持', '补贴'],
    urls: [
      'https://www.sz.gov.cn/cn/xxgk/zfxxgj/zcfg/',
      'https://www.sz.gov.cn/cn/xxgk/tzgg/'
    ]
  }
];

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate',
  'Connection': 'keep-alive',
  'Cache-Control': 'max-age=0'
};

async function fetchAndParse(source) {
  console.log(`🔍 正在抓取: ${source.name}`);
  const results = [];
  
  for (const url of source.urls) {
    try {
      console.log(`   └─ 访问: ${url}`);
      const response = await axios.get(url, {
        headers: { ...DEFAULT_HEADERS, Referer: url },
        timeout: 30000,
        httpsAgent: new (require('https').Agent)({
          rejectUnauthorized: false,
          secureProtocol: 'TLSv1_2_method'
        })
      });

      const html = response.data;
      const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
      let match;
      
      while ((match = linkRegex.exec(html)) !== null) {
        const href = match[1];
        const title = match[2].trim();
        
        if (!href || !title || title.length < 10) continue;
        
        if (source.keywords.some(kw => title.includes(kw))) {
          let cleanUrl = href;
          if (!href.startsWith('http')) {
            const baseUrl = url.match(/https?:\/\/[^/]+/)[0];
            cleanUrl = href.startsWith('/') ? `${baseUrl}${href}` : `${baseUrl}/${href}`;
          }
          
          const dateMatch = html.match(new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?(\\d{4}-\\d{2}-\\d{2})'));
          const date = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];
          
          results.push({
            title,
            date,
            url: cleanUrl,
            source: source.name,
            source_id: source.source_id,
            level: source.level,
            levelText: source.levelText,
            category: determineCategory(title, source.level)
          });
        }
      }
      
      console.log(`   └─ 找到: ${results.length} 条相关内容`);
    } catch (error) {
      console.log(`   └─ ❌ 失败: ${error.message}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log(`✅ 抓取完成: ${source.name} - 共 ${results.length} 条`);
  return results;
}

function determineCategory(title, level) {
  const cats = [];
  if (/人工智能|AI|大模型|算力|智能/.test(title)) cats.push('ai');
  if (/机器人|具身|人形/.test(title)) cats.push('robot');
  if (/申报|申请|指南|专项|配套/.test(title)) cats.push('apply');
  if (level === 'city') cats.push('shenzhen');
  return cats.length ? cats : ['ai'];
}

function generateTags(title) {
  const tags = [];
  const tagMap = {
    '人工智能': '人工智能', 'AI': 'AI', '大模型': '大模型',
    '机器人': '机器人', '人形': '人形机器人', '具身': '具身智能',
    '算力': '算力', '训力券': '训力券', '语料': '语料',
    '申报': '项目申报', '申请': '项目申请', '指南': '申报指南',
    '补贴': '补贴', '扶持': '扶持', '资助': '资助',
    '标准': '标准化', '规范': '行业规范',
    '深圳': '深圳', '广东': '广东', '创新': '科技创新',
    '数据': '数据要素', '安全': '安全监管'
  };
  for (const [kw, tag] of Object.entries(tagMap)) {
    if (title.includes(kw) && tags.length < 5) tags.push(tag);
  }
  return tags.length ? tags : ['政策文件'];
}

async function main() {
  console.log('🚀 开始执行政策数据抓取...');
  
  let allPolicies = [];
  
  for (const source of DATA_SOURCES) {
    const policies = await fetchAndParse(source);
    allPolicies = allPolicies.concat(policies);
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  const seen = new Set();
  const unique = allPolicies.filter(p => {
    const key = p.title.replace(/\s+/g, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  unique.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  let existingPolicies = [];
  const policyPath = path.join(__dirname, 'policies.json');
  
  try {
    const existingData = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
    existingPolicies = existingData.policies || [];
  } catch (e) {
    console.log('ℹ️ 未找到现有数据文件，将创建新文件');
  }
  
  const existingTitles = new Set(existingPolicies.map(p => p.title.replace(/\s+/g, '')));
  for (const old of existingPolicies) {
    const key = old.title.replace(/\s+/g, '');
    if (!seen.has(key)) {
      unique.push(old);
      seen.add(key);
    }
  }
  
  unique.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  const output = unique.map((p, idx) => ({
    id: idx + 1,
    title: p.title,
    level: p.level,
    levelText: p.levelText,
    department: p.source,
    date: p.date,
    category: p.category,
    tags: generateTags(p.title),
    summary: `${p.source}发布：${p.title}。详见官方原文链接。`,
    url: p.url,
    relevance: p.level === 'national' ? 85 : p.level === 'provincial' ? 82 : 80,
    fetchedAt: new Date().toISOString().split('T')[0]
  }));
  
  const result = {
    policies: output,
    meta: {
      total: output.length,
      updatedAt: new Date().toISOString(),
      sources: DATA_SOURCES.map(s => s.name),
      newToday: allPolicies.length,
      updateMethod: '网页抓取'
    }
  };
  
  fs.writeFileSync(policyPath, JSON.stringify(result, null, 2));
  
  console.log(`🎉 抓取完成！共 ${output.length} 条政策，今日新增 ${allPolicies.length} 条`);
}

main().catch(console.error);