export const publicationsData = [
  {
    name: 'XL-VLA: Cross-Hand Latent Representation for Vision-Language-Action Models',
    authors:
      '<br/>Guangqi Jiang*, <b>Yutong Liang</b>*, Jianglong Ye, Jia-Yang Huang, Changwei Jing, Rocky Duan, Pieter Abbeel, Xiaolong Wang&dagger;, Xueyan Zou&dagger;',
    venue: 'CVPR',
    year: '2026',
    video: 'covers/xl_vla_teaser.mp4',
    abstract:
      'Dexterous manipulation is essential for real-world robot autonomy, mirroring the central role of human hand coordination in daily activity. Humans rely on rich multimodal perception, vision, sound, and language-guided intent, to perform dexterous actions, motivating vision-based, language-conditioned manipulation systems for robots. However, training reliable vision-language-action models for dexterous manipulation requires large-scale demonstrations across many robotic hands. In addition, as new dexterous embodiments appear rapidly, collecting data for each becomes costly and impractical, creating a need for scalable cross-embodiment learning. We introduce XL-VLA, a vision-language-action framework integrated with a unified latent action space shared across diverse dexterous hands. This embodiment-invariant latent space is directly pluggable into standard VLA architectures, enabling seamless cross-embodiment training and efficient reuse of both existing and newly collected data. Experimental results demonstrate that XL-VLA consistently outperforms baseline VLA models operating in raw joint spaces, establishing it as an effective solution for scalable cross-embodiment dexterous manipulation.',
    details: '',
    links: [
      { type: 'site', href: 'https://xl-vla.github.io' },
      { type: 'arxiv', href: 'https://arxiv.org/abs/2603.10158' },
      { type: 'github', href: 'https://github.com/EmptyBlueBox/DexLatent' }
    ]
  },
  {
    name: 'DexterCap: An Affordable and Automated System for Capturing Dexterous Hand-Object Manipulation',
    authors: '<br/><b>Yutong Liang</b>*, Shiyi Xu*, Yulong Zhang*, Bowen Zhan, He Zhang, Libin Liu',
    venue: 'Eurographics',
    year: '2026',
    image: 'covers/dextercap.png',
    video: 'covers/dexterhand.mp4',
    abstract:
      "Capturing fine-grained hand-object interactions is challenging due to severe self-occlusion from closely spaced fingers and the subtlety of in-hand manipulation motions. Existing optical motion capture systems rely on expensive camera setups and extensive manual post-processing, while low-cost vision-based methods often suffer from reduced accuracy and reliability under occlusion. To address these challenges, we present DexterCap, a low-cost optical capture system for dexterous in-hand manipulation. DexterCap uses dense, character-coded marker patches to achieve robust tracking under severe self-occlusion, together with an automated reconstruction pipeline that requires minimal manual effort. With DexterCap, we introduce DexterHand, a dataset of fine-grained hand-object interactions covering diverse manipulation behaviors and objects, from simple primitives to complex articulated objects such as a Rubik's Cube. We release the dataset and code to support future research on dexterous hand-object interaction.",
    details: '',
    links: [
      { type: 'site', href: 'https://pku-mocca.github.io/Dextercap-Page/' },
      { type: 'arxiv', href: 'https://arxiv.org/abs/2601.05844' },
      { type: 'github', href: 'https://github.com/PKU-MoCCA/dextercap/' },
      { type: 'release', href: 'https://huggingface.co/datasets/pku-mocca/DexterHand/' },
      { type: 'slide', href: '/projects/DexterCap' }
    ]
  },
  {
    name: 'GSWorld: Closed-Loop Photo-Realistic Simulation Suite for Robotic Manipulation',
    authors:
      '<br/>Guangqi Jiang, Haoran Chang, Ri-Zhao Qiu, <b>Yutong Liang</b>, Mazeyu Ji, Jiyue Zhu, Zhao Dong, Xueyan Zou, Xiaolong Wang',
    venue: 'ICRA',
    year: '2026',
    image: 'covers/gsworld.png',
    video: 'covers/gsworld.mp4',
    abstract: '',
    details: '',
    links: [
      { type: 'site', href: 'https://3dgsworld.github.io' },
      { type: 'arxiv', href: 'https://arxiv.org/abs/2510.20813' },
      { type: 'github', href: 'https://github.com/luccachiang/GSWorld' },
      { type: 'video', href: 'https://www.youtube.com/watch?v=uNj8RuFrhgQ' }
    ]
  },
  {
    name: 'ROBOVERSE: Towards a Unified Platform, Dataset and Benchmark for Scalable and Generalizable Robot Learning',
    authors: '<br/>RoboVerse Team',
    venue: 'RSS',
    year: '2025',
    image: 'covers/roboverse-official.jpg',
    abstract: '',
    details: '',
    links: [
      { type: 'site', href: 'https://roboverseorg.github.io' },
      { type: 'arxiv', href: 'https://arxiv.org/abs/2504.18904' },
      { type: 'github', href: 'https://github.com/RoboVerseOrg/RoboVerse' }
    ]
  },
  {
    name: 'SimiSketch: A Sketching Algorithm for Similarity Estimation',
    authors:
      '<br/>Fenghao Dong, Yang He*, <b>Yutong Liang</b>*, Zirui Liu, Yuhan Wu, Peiqing Chen, and Tong Yang',
    venue: 'arXiv preprint 2405.19711',
    year: '2024',
    image: 'covers/simisketch.png',
    details: '',
    links: [
      { type: 'arxiv', href: 'https://arxiv.org/abs/2405.19711' },
      { type: 'github', href: 'https://github.com/SimiSketch/SimiSketch' }
    ]
  }
]
