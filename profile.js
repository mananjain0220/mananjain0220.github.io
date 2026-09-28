// Curated professional information only. No source CV, private notes, career
// roadmap, personal contact data or credential identifiers belong in this file.
export const workOrder = ['research', 'ml', 'engineering'];

export const workAreas = {
  research: {
    title: 'Security research', subtitle: 'ATTRIBUT / MLU Halle-Wittenberg',
    sticker: 'signal',
    preview: {
      title: 'From signal to evidence.', label: 'RESEARCH',
      caption: 'Observe · compare · attribute',
      description: 'Illustration: observations are compared with a baseline before attribution. No measured detector output is shown.',
    },
  },
  ml: {
    title: 'Applied ML & XAI', subtitle: 'Multimodal learning / EvoLearner',
    sticker: 'fusion',
    preview: {
      title: 'Two inputs. One model.', label: 'ML / XAI',
      caption: 'Images + tabular data · multimodal learning',
      description: 'Illustration: image and tabular inputs join in a multimodal model, followed by evaluation. This is a conceptual workflow, not a project result.',
    },
  },
  engineering: {
    title: 'Software & testing', subtitle: 'CHECK24 / dSPACE',
    sticker: 'build-test',
    preview: {
      title: 'Build. Test. Refine.', label: 'BUILD / TEST',
      caption: 'Software · APIs · test automation',
      description: 'Illustration: implementation, tests and review form a feedback cycle. The diagram is not a live CI run or a claim about a specific deployment.',
    },
  },
};

export const panels = {
  research: {
    kicker: '01 / SECURITY RESEARCH', title: 'Finding what is hidden.',
    text: 'As a Research Associate at MLU Halle-Wittenberg, I work on detection and attribution of hidden information in ATTRIBUT.',
    entries: [
      {title: 'My contribution', text: 'Statistical and ML methods, attribution tools, and research reporting.'},
      {title: 'One example: document signals', text: 'The interactive case illustrates the questions behind this work. It is a synthetic walkthrough, not a live detector or an evaluation result.'},
    ],
    caseAction: 'Explore the document case',
    links: [
      {label: 'Research chapter ↗', href: 'https://link.springer.com/chapter/10.1007/978-3-032-35586-7_11'},
      {label: 'Public corpus ↗', href: 'https://github.com/mananjain0220/pdf-steganalysis-corpus'},
    ],
  },
  ml: {
    kicker: '02 / APPLIED ML & EXPLAINABLE AI', title: 'Build models. Test ideas.',
    entries: [
      {title: 'Multimodal ML · Cargoboard', text: 'For my master’s thesis, I combined images and tabular data for transport-damage detection. I implemented and compared PyTorch models using precision, recall and mAP.'},
      {title: 'EvoLearner / XAI · Paderborn', text: 'In a university project group, I contributed to knowledge-graph learning experiments: representation learning, initialization methods, and ablation studies.'},
    ],
  },
  engineering: {
    kicker: '03 / SOFTWARE ENGINEERING & RELIABILITY', title: 'Beyond the experiment.',
    entries: [
      {title: 'CHECK24 · Application development', text: 'Built mobile interfaces in Swift, integrated REST APIs, and wrote XCTest unit tests in collaboration with product and backend teams.'},
      {title: 'dSPACE · Embedded-system testing', text: 'Worked on test automation, test-data preparation, and error analysis to support reliable embedded-system testing.'},
    ],
  },
  foundations: {
    kicker: 'SECURITY FOUNDATIONS', title: 'ISC2 Certified in Cybersecurity.',
    text: 'CC adds a foundation in security principles, access control, network security and security operations alongside my research and engineering work.',
  },
  direction: {
    kicker: 'DEVELOPING DIRECTION', title: 'Toward AI / ML security.',
    text: 'Building on my ML, engineering and security-research experience. These are interests I’m developing, not established expertise.',
    items: ['Adversarial ML & robustness', 'LLM / agent security', 'Detection, attribution & AI-content provenance'],
    note: 'HTB AI Red Teamer learning path — in progress.',
  },
};

// Artwork, hit targets and projected connector share the same texture space.
// Tabs select a preview; the preview and its explicit CTA open selected work.
// The browser chrome and empty margins are inert. HTML work buttons remain
// the primary accessible alternative to all canvas actions.
export const screenLayout = {
  width: 1536, height: 996,
  preview: {x: 76, y: 126, width: 1384, height: 674},
  open: {x: 1030, y: 850, width: 430, height: 96},
  anchor: {x: 100, y: 494},
};
export const screenTabs = workOrder.map((id, index) => ({
  id, x: 76 + index * 190, y: 850, width: 166, height: 96,
}));

export function screenActionAt(uv, selected = 'research') {
  if (!uv || !Number.isFinite(uv.x) || !Number.isFinite(uv.y)) return null;
  const x = uv.x * screenLayout.width, y = (1 - uv.y) * screenLayout.height;
  const inside = region => x >= region.x && x <= region.x + region.width && y >= region.y && y <= region.y + region.height;
  const tab = screenTabs.find(inside);
  if (tab) return {kind:'select', id:tab.id};
  if (workOrder.includes(selected) && (inside(screenLayout.preview) || inside(screenLayout.open))) return {kind:'open', id:selected};
  return null;
}
