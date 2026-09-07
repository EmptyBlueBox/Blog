export const publicationsData = [
  {
    name: 'FACT: Failure-Aware Causal Training for World-Action Models',
    authors: '<br/>Quanquan Peng*, <b>Yutong Liang</b>*, Rui Yan, Nicklas Hansen, Xiaolong Wang',
    venue: 'CoRL',
    year: '2026',
    video: 'covers/fact.mp4',
    takeaway:
      'Failure rollouts teach an action-conditioned world model to predict the consequences of failed actions without imitating them.',
    details: '',
    links: [
      { type: 'site', href: 'https://fact-wam.github.io' },
      { type: 'arxiv', href: 'https://arxiv.org/abs/2608.10232' },
      { type: 'github', href: 'https://github.com/Bariona/FACT' },
      { type: 'video', href: 'https://youtu.be/sZuzUPDoJ9U' }
    ],
    bibtex: `@article{peng2026fact,
      title={FACT: Failure-Aware Causal Training for World-Action Models},
      author={Quanquan Peng and Yutong Liang and Rui Yan and Nicklas Hansen and Xiaolong Wang},
      journal={arXiv preprint arXiv:2608.10232},
      year={2026}
}`
  },
  {
    name: 'ConTrack: Constrained Hand Motion Tracking with Adaptive Trade-off Control',
    authors: '<br/><b>Yutong Liang</b>, Quanquan Peng, Ri-Zhao Qiu, Xiaolong Wang',
    venue: 'ECCV',
    year: '2026',
    video: 'covers/contrack_teaser-480p.mp4',
    takeaway:
      "Constrained reinforcement learning preserves object motion while adapting hand motion and contact to the robot's kinematics.",
    details: '',
    links: [
      { type: 'site', href: '/projects/ConTrack' },
      { type: 'arxiv', href: 'https://arxiv.org/abs/2606.03177' },
      { type: 'github', href: 'https://github.com/EmptyBlueBox/ConTrack' },
      { type: 'video', href: 'https://www.youtube.com/watch?v=Rr96tHf0ZUU' },
      { type: 'x', href: 'https://x.com/YutongLiang_/status/2062212378721419371' }
    ],
    bibtex: `@article{liang2026contrack,
      title={ConTrack: Constrained Hand Motion Tracking with Adaptive Trade-off Control}, 
      author={Yutong Liang and Quanquan Peng and Ri-Zhao Qiu and Xiaolong Wang},
      journal={arXiv preprint arXiv:2606.03177},
      year={2026}
}`
  },
  {
    name: 'XL-VLA: Cross-Hand Latent Representation for Vision-Language-Action Models',
    authors:
      '<br/>Guangqi Jiang*, <b>Yutong Liang</b>*, Jianglong Ye, Jia-Yang Huang, Changwei Jing, Rocky Duan, Pieter Abbeel, Xiaolong Wang&dagger;, Xueyan Zou&dagger;',
    venue: 'CVPR',
    year: '2026',
    note: 'Highlight',
    video: 'covers/xl_vla_teaser.mp4',
    takeaway:
      'A shared latent action space, learned from kinematic constraints without demonstrations, enables VLA learning across four dexterous hands.',
    details: '',
    links: [
      { type: 'site', href: 'https://xl-vla.github.io' },
      { type: 'arxiv', href: 'https://arxiv.org/abs/2603.10158' },
      { type: 'github', href: 'https://github.com/EmptyBlueBox/DexLatent' },
      { type: 'x', href: 'https://x.com/LuccaChiang/status/2031386138951163905' }
    ],
    bibtex: `@article{jiang2026crosshand,
      title={Cross-Hand Latent Representation for Vision-Language-Action Models}, 
      author={Guangqi Jiang and Yutong Liang and Jianglong Ye and Jia-Yang Huang and Changwei Jing and Rocky Duan and Pieter Abbeel and Xiaolong Wang and Xueyan Zou},
      journal={arXiv preprint arXiv:2603.10158},
      year={2026}
}`
  },
  {
    name: 'DexterCap: An Affordable and Automated System for Capturing Dexterous Hand-Object Manipulation',
    authors: '<br/><b>Yutong Liang</b>*, Shiyi Xu*, Yulong Zhang*, Bowen Zhan, He Zhang, Libin Liu',
    venue: 'Eurographics',
    year: '2026',
    video: 'covers/dexterhand.mp4',
    takeaway:
      'Coded markers and automated reconstruction capture fine-grained hand–object motion, including dexterous manipulation of articulated objects.',
    details: '',
    links: [
      { type: 'site', href: 'https://pku-mocca.github.io/Dextercap-Page/' },
      { type: 'arxiv', href: 'https://arxiv.org/abs/2601.05844' },
      { type: 'github', href: 'https://github.com/PKU-MoCCA/dextercap/' },
      { type: 'rerun', href: '/projects/DexterCap' },
      { type: 'huggingface', href: 'https://huggingface.co/datasets/pku-mocca/DexterHand/' },
      { type: 'x', href: 'https://x.com/YutongLiang_/status/2011121845282738518' }
    ],
    bibtex: `@article{liang2026dextercap,
      title={DexterCap: An Affordable and Automated System for Capturing Dexterous Hand-Object Manipulation}, 
      author={Yutong Liang and Shiyi Xu and Yulong Zhang and Bowen Zhan and He Zhang and Libin Liu},
      journal={arXiv preprint arXiv:2601.05844},
      year={2026}
}`
  },
  {
    name: 'GSWorld: Closed-Loop Photo-Realistic Simulation Suite for Robotic Manipulation',
    authors:
      '<br/>Guangqi Jiang*, Haoran Chang*, Ri-Zhao Qiu, <b>Yutong Liang</b>, Mazeyu Ji, Jiyue Zhu, Zhao Dong, Xueyan Zou, Xiaolong Wang',
    venue: 'ICRA',
    year: '2026',
    image: 'covers/gsworld.png',
    video: 'covers/gsworld.mp4',
    takeaway: '',
    details: '',
    links: [
      { type: 'site', href: 'https://3dgsworld.github.io' },
      { type: 'arxiv', href: 'https://arxiv.org/abs/2510.20813' },
      { type: 'github', href: 'https://github.com/luccachiang/GSWorld' },
      { type: 'youtube', href: 'https://www.youtube.com/watch?v=uNj8RuFrhgQ' },
      { type: 'x', href: 'https://x.com/LuccaChiang/status/1982961100351250554' }
    ],
    bibtex: `@article{jiang2025gsworld,
      title={GSWorld: Closed-Loop Photo-Realistic Simulation Suite for Robotic Manipulation}, 
      author={Guangqi Jiang and Haoran Chang and Ri-Zhao Qiu and Yutong Liang and Mazeyu Ji and Jiyue Zhu and Zhao Dong and Xueyan Zou and Xiaolong Wang},
      journal={arXiv preprint arXiv:2510.20813},
      year={2025}
}`
  },
  {
    name: 'ROBOVERSE: Towards a Unified Platform, Dataset and Benchmark for Scalable and Generalizable Robot Learning',
    authors: '<br/>RoboVerse Team',
    venue: 'RSS',
    year: '2025',
    image: 'covers/roboverse-official.jpg',
    takeaway: '',
    details: '',
    links: [
      { type: 'site', href: 'https://roboverseorg.github.io' },
      { type: 'arxiv', href: 'https://arxiv.org/abs/2504.18904' },
      { type: 'github', href: 'https://github.com/RoboVerseOrg/RoboVerse' },
      { type: 'x', href: 'https://x.com/HaoranGeng2/status/1909251593511559516' }
    ],
    bibtex: `@article{geng2025roboverse,
      title={RoboVerse: Towards a Unified Platform, Dataset and Benchmark for Scalable and Generalizable Robot Learning}, 
      author={Haoran Geng and Feishi Wang and Songlin Wei and Yuyang Li and Bangjun Wang and Boshi An and Charlie Tianyue Cheng and Haozhe Lou and Peihao Li and Yen-Jen Wang and Yutong Liang and Dylan Goetting and Chaoyi Xu and Haozhe Chen and Yuxi Qian and Yiran Geng and Jiageng Mao and Weikang Wan and Mingtong Zhang and Jiangran Lyu and Siheng Zhao and Jiazhao Zhang and Jialiang Zhang and Chengyang Zhao and Haoran Lu and Yufei Ding and Ran Gong and Yuran Wang and Yuxuan Kuang and Ruihai Wu and Baoxiong Jia and Carlo Sferrazza and Hao Dong and Siyuan Huang and Yue Wang and Jitendra Malik and Pieter Abbeel},
      journal={arXiv preprint arXiv:2504.18904},
      year={2025}
}`
  },
  {
    name: 'SimiSketch: A Sketching Algorithm for Similarity Estimation',
    authors:
      '<br/>Fenghao Dong, Yang He*, <b>Yutong Liang</b>*, Zirui Liu, Yuhan Wu, Peiqing Chen, and Tong Yang',
    venue: 'arXiv',
    year: '2024',
    details: '',
    links: [
      { type: 'arxiv', href: 'https://arxiv.org/abs/2405.19711' },
      { type: 'github', href: 'https://github.com/SimiSketch/SimiSketch' }
    ],
    bibtex: `@article{dong2024simisketch,
      title={SimiSketch: Efficiently Estimating Similarity of streaming Multisets}, 
      author={Fenghao Dong and Yang He and Yutong Liang and Zirui Liu and Yuhan Wu and Peiqing Chen and Tong Yang},
      journal={arXiv preprint arXiv:2405.19711},
      year={2024}
}`
  }
]
