const API_BASE = 'http://localhost:8000';

export const PIPELINE_STAGES = [
  { key: 'extract',    label: 'Extract',      iconName: 'FileText' },
  { key: 'retrieve',   label: 'Retrieve',     iconName: 'Database' },
  { key: 'specialist', label: 'Specialists',  iconName: 'Users' },
  { key: 'reviewer',   label: 'Review',       iconName: 'Scale' },
  { key: 'cmo',        label: 'Rank',         iconName: 'Trophy' },
  { key: 'plan_next',  label: 'Next Steps',   iconName: 'Compass' },
];

export const SYSTEM_ICONS = {
  neurology:       'Brain',
  metabolic:       'Dna',
  genetics:        'Microscope',
  cardiology:      'Heart',
  musculoskeletal: 'Activity',
  sensory:         'Eye',
  other:           'Layers',
  reviewer:        'Scale',
};

export const SYSTEM_ABBREVIATIONS = {
  neurology:       'NEU',
  metabolic:       'MET',
  genetics:        'GEN',
  cardiology:      'CAR',
  musculoskeletal: 'MSK',
  sensory:         'SEN',
  other:           'OTH',
  reviewer:        'REV',
};

export const EXAMPLE_CASE = `6-year-old boy. Progressive muscle weakness since age 3, very high CK level (markedly elevated creatine kinase), delayed speech and language development, sensorineural hearing loss in both ears. Calf pseudohypertrophy noted on examination. No seizures. No cardiac involvement at this time. Family history: maternal uncle had similar symptoms, wheelchair-bound by age 12.`;

export default API_BASE;
