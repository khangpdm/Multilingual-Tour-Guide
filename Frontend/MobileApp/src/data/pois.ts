export type Language = 'vi' | 'en' | 'fr' | 'ja' | 'ko' | 'zh';
export type Category = 'Di tích' | 'Bảo tàng' | 'Tôn giáo' | 'Kiến trúc' | 'Công viên' | 'Ẩm thực';

export interface POI {
  id: string;
  name: Record<Language, string>;
  category: Category;
  address: string;
  lat: number;
  lng: number;
  coverImage: string;
  shortDesc: Record<Language, string | null>;
  description: Record<Language, string | null>;
  ttsScript: Record<Language, string | null>;
  mapLink: string;
  activationRadius: number;
}

export const POIS: POI[] = [
  {
    id: 'post-office',
    name: {
      vi: 'Bưu điện Thành phố Hồ Chí Minh',
      en: 'Ho Chi Minh City Central Post Office',
      fr: 'Bureau de Poste Central de Ho Chi Minh-Ville',
      ja: 'ホーチミン市中央郵便局',
      ko: '호치민 중앙 우체국',
      zh: '胡志明市中央邮局',
    },
    category: 'Kiến trúc',
    address: '2 Công xã Paris, Bến Nghé, Quận 1, TP.HCM',
    lat: 10.7797,
    lng: 106.6994,
    coverImage:
      'https://images.unsplash.com/photo-1708275534618-7df4066b391d?w=800&h=500&fit=crop&auto=format',
    shortDesc: {
      vi: 'Công trình kiến trúc Pháp nổi bật tại trung tâm TP.HCM',
      en: 'Iconic French colonial architecture at the heart of HCMC',
      fr: 'Architecture coloniale française emblématique au cœur de HCMC',
      ja: null,
      ko: null,
      zh: null,
    },
    description: {
      vi: 'Bưu điện Trung tâm Sài Gòn là một trong những công trình kiến trúc nổi bật nhất của Thành phố Hồ Chí Minh. Được xây dựng vào cuối thế kỷ 19 dưới thời Pháp thuộc (1886–1891), tòa nhà được thiết kế bởi Gustave Eiffel và mang đậm phong cách kiến trúc Gothic và Baroque kết hợp với nét truyền thống Việt Nam. Bên trong, bức bản đồ bưu cục miền Nam Việt Nam và Campuchia cũ vẫn được bảo tồn trên vách tường. Đây là nơi tham quan không thể bỏ qua khi đến Sài Gòn.',
      en: 'The Saigon Central Post Office is one of the most prominent architectural landmarks in Ho Chi Minh City. Built in the late 19th century (1886–1891), designed by Gustave Eiffel, it features a blend of Gothic, Baroque, and traditional Vietnamese styles. Inside, historical maps of southern Vietnam and Cambodia are preserved on the walls. A must-visit destination in Saigon.',
      fr: "La Poste Centrale de Saïgon est l'un des monuments architecturaux les plus remarquables de Hô Chi Minh-Ville. Construite entre 1886 et 1891 et conçue par Gustave Eiffel, elle mêle les styles gothique, baroque et vietnamien traditionnel.",
      ja: null,
      ko: null,
      zh: null,
    },
    ttsScript: {
      vi: 'Chào mừng bạn đến với Bưu điện Trung tâm Sài Gòn. Đây là một trong những công trình kiến trúc Pháp nổi bật nhất tại Thành phố Hồ Chí Minh, được xây dựng từ năm 1886 đến 1891. Tòa nhà được thiết kế bởi Gustave Eiffel, với phong cách kết hợp Gothic và Baroque. Bên trong, bạn sẽ thấy những bức bản đồ lịch sử được bảo tồn trên vách tường.',
      en: 'Welcome to the Saigon Central Post Office. This is one of the most iconic French colonial buildings in Ho Chi Minh City, built between 1886 and 1891. Designed by Gustave Eiffel, the building showcases a blend of Gothic and Baroque styles. Inside, you will find historical maps preserved on the walls.',
      fr: "Bienvenue à la Poste Centrale de Saïgon. Ce monument est l'un des plus emblématiques de Hô Chi Minh-Ville, construit entre 1886 et 1891 par Gustave Eiffel.",
      ja: null,
      ko: null,
      zh: null,
    },
    mapLink: 'https://maps.google.com/?q=10.7797,106.6994',
    activationRadius: 100,
  },
  {
    id: 'cathedral',
    name: {
      vi: 'Nhà thờ Đức Bà Sài Gòn',
      en: 'Notre-Dame Cathedral Basilica of Saigon',
      fr: 'Basilique-Cathédrale Notre-Dame de Saïgon',
      ja: 'サイゴン・ノートルダム大聖堂',
      ko: '사이공 노트르담 대성당',
      zh: '西贡圣母大教堂',
    },
    category: 'Tôn giáo',
    address: '1 Công xã Paris, Bến Nghé, Quận 1, TP.HCM',
    lat: 10.78,
    lng: 106.699,
    coverImage:
      'https://images.unsplash.com/photo-1583943349419-6ce221d3734a?w=800&h=500&fit=crop&auto=format',
    shortDesc: {
      vi: 'Nhà thờ Công giáo mang kiến trúc Gothic độc đáo, 1863–1880',
      en: 'Catholic cathedral with unique Gothic architecture, 1863–1880',
      fr: "Cathédrale catholique à l'architecture gothique, 1863–1880",
      ja: 'ゴシック建築の独特なカトリック大聖堂 (1863–1880)',
      ko: '고딕 양식의 독특한 가톨릭 성당, 1863–1880',
      zh: '独特的哥特式建筑天主教堂，1863–1880',
    },
    description: {
      vi: 'Nhà thờ Đức Bà Sài Gòn là một nhà thờ Công giáo nổi tiếng tại Thành phố Hồ Chí Minh. Được xây dựng từ năm 1863 đến 1880, tòa nhà là một trong những công trình kiến trúc Gothic tiêu biểu tại Việt Nam. Với hai tháp chuông cao 57 mét, nhà thờ là điểm nhấn nổi bật của quảng trường Công xã Paris. Toàn bộ vật liệu xây dựng được nhập khẩu từ Pháp, kể cả những viên gạch đỏ đặc trưng.',
      en: 'Notre-Dame Cathedral Basilica of Saigon is a prominent Catholic cathedral in Ho Chi Minh City. Built between 1863 and 1880, it is one of the most iconic Gothic structures in Vietnam. Twin bell towers at 57 meters tall dominate Paris Commune Square. All construction materials were imported from France, including the distinctive red bricks.',
      fr: 'La Basilique-Cathédrale Notre-Dame de Saïgon est une cathédrale catholique emblématique de Hô Chi Minh-Ville. Construite entre 1863 et 1880, ses deux clochers de 57 mètres dominent la Place de la Commune de Paris. Tous les matériaux ont été importés de France.',
      ja: 'サイゴンのノートルダム大聖堂は、ホーチミン市で最も有名なカトリック大聖堂です。1863年から1880年にかけて建設され、57メートルの双塔がパリ・コミューン広場に君臨しています。',
      ko: '사이공 노트르담 대성당은 호치민 시에서 가장 유명한 가톨릭 성당입니다. 1863년부터 1880년까지 건설되었으며, 57미터 높이의 쌍탑이 파리 코뮌 광장을 지배합니다.',
      zh: '西贡圣母大教堂是胡志明市最著名的天主教堂，建于1863年至1880年间。57米高的双塔主导着巴黎公社广场。所有建筑材料均从法国进口。',
    },
    ttsScript: {
      vi: 'Chào mừng bạn đến với Nhà thờ Đức Bà Sài Gòn. Đây là nhà thờ Công giáo nổi tiếng nhất tại Thành phố Hồ Chí Minh, được xây dựng từ năm 1863 đến 1880. Hai tháp chuông cao 57 mét là biểu tượng của Sài Gòn. Toàn bộ vật liệu xây dựng được nhập từ Pháp.',
      en: 'Welcome to Notre-Dame Cathedral Basilica of Saigon. Built between 1863 and 1880, the twin bell towers standing 57 meters tall are symbols of Saigon. All construction materials were imported from France.',
      fr: 'Bienvenue à la Basilique-Cathédrale Notre-Dame de Saïgon, construite entre 1863 et 1880. Ses clochers de 57 mètres sont les symboles de Saïgon.',
      ja: 'サイゴンのノートルダム大聖堂へようこそ。1863年から1880年にかけて建設されたこの大聖堂は、57メートルの双塔がサイゴンのシンボルです。',
      ko: '사이공 노트르담 대성당에 오신 것을 환영합니다. 1863년부터 1880년까지 건설되었으며, 57미터 쌍탑은 사이공의 상징입니다.',
      zh: '欢迎来到西贡圣母大教堂。建于1863至1880年，57米高的双塔是西贡的象征。',
    },
    mapLink: 'https://maps.google.com/?q=10.7800,106.6990',
    activationRadius: 100,
  },
  {
    id: 'independence-palace',
    name: {
      vi: 'Dinh Độc Lập',
      en: 'Independence Palace',
      fr: 'Palais de la Réunification',
      ja: '統一会堂',
      ko: '통일궁',
      zh: '统一宫',
    },
    category: 'Di tích',
    address: '135 Nam Kỳ Khởi Nghĩa, Bến Thành, Quận 1, TP.HCM',
    lat: 10.7767,
    lng: 106.6953,
    coverImage:
      'https://images.unsplash.com/photo-1635652270109-23be0947ba17?w=800&h=500&fit=crop&auto=format',
    shortDesc: {
      vi: 'Di tích lịch sử quan trọng, biểu tượng thống nhất đất nước',
      en: "Historic landmark symbolizing Vietnam's reunification in 1975",
      fr: null,
      ja: null,
      ko: null,
      zh: null,
    },
    description: {
      vi: 'Dinh Độc Lập (hay Dinh Thống Nhất) là một công trình kiến trúc lịch sử quan trọng của Việt Nam. Được xây dựng lại vào năm 1966, tòa nhà từng là dinh thự của Tổng thống Việt Nam Cộng hòa. Ngày 30 tháng 4 năm 1975, xe tăng của Quân Giải phóng húc đổ cổng dinh, đánh dấu sự kết thúc của chiến tranh và thống nhất đất nước. Ngày nay, dinh là bảo tàng và khu di tích quốc gia mở cửa đón du khách.',
      en: 'Independence Palace (or Reunification Palace) is a key historical landmark of Vietnam. Rebuilt in 1966, it served as the presidential residence of the Republic of Vietnam. On April 30, 1975, Liberation Army tanks broke down the gates, marking the end of the war and reunification. Today, the palace is a museum and national heritage site open to visitors.',
      fr: null,
      ja: null,
      ko: null,
      zh: null,
    },
    ttsScript: {
      vi: 'Chào mừng bạn đến với Dinh Độc Lập. Công trình lịch sử này được xây dựng lại vào năm 1966 và từng là dinh thự của Tổng thống Việt Nam Cộng hòa. Vào ngày 30 tháng 4 năm 1975, đây là nơi chứng kiến khoảnh khắc lịch sử thống nhất đất nước Việt Nam.',
      en: 'Welcome to Independence Palace. Rebuilt in 1966, it served as the presidential residence of the Republic of Vietnam. On April 30, 1975, this was the site of the historic Vietnamese reunification.',
      fr: null,
      ja: null,
      ko: null,
      zh: null,
    },
    mapLink: 'https://maps.google.com/?q=10.7767,106.6953',
    activationRadius: 150,
  },
  {
    id: 'ben-thanh',
    name: {
      vi: 'Chợ Bến Thành',
      en: 'Ben Thanh Market',
      fr: 'Marché Bến Thành',
      ja: 'ベンタイン市場',
      ko: '벤탄 시장',
      zh: '滨城市场',
    },
    category: 'Ẩm thực',
    address: 'Lê Lợi, Bến Thành, Quận 1, TP.HCM',
    lat: 10.7724,
    lng: 106.698,
    coverImage:
      'https://images.unsplash.com/photo-1771047060640-ce841935e1fe?w=800&h=500&fit=crop&auto=format',
    shortDesc: {
      vi: 'Trung tâm mua sắm và ẩm thực nổi tiếng nhất Sài Gòn',
      en: "Saigon's most iconic shopping and street food market",
      fr: null,
      ja: null,
      ko: null,
      zh: null,
    },
    description: {
      vi: 'Chợ Bến Thành là một trong những chợ nổi tiếng nhất và lâu đời nhất tại Thành phố Hồ Chí Minh. Được xây dựng từ năm 1912 đến 1914, chợ là trung tâm mua sắm, ẩm thực và văn hóa của người Sài Gòn. Với hơn 3.000 quầy hàng, chợ bán đủ các mặt hàng từ thực phẩm, quần áo đến đồ lưu niệm. Tháp đồng hồ là biểu tượng đặc trưng của chợ và là điểm gặp gỡ quen thuộc của người dân.',
      en: "Ben Thanh Market is one of the oldest and most famous markets in Ho Chi Minh City. Built between 1912 and 1914, it is a center for shopping, food, and culture. With over 3,000 stalls selling everything from food and clothing to souvenirs, the iconic clock tower serves as the city's most popular meeting point.",
      fr: null,
      ja: null,
      ko: null,
      zh: null,
    },
    ttsScript: {
      vi: 'Chào mừng bạn đến với Chợ Bến Thành. Đây là một trong những chợ nổi tiếng và lâu đời nhất tại Thành phố Hồ Chí Minh, được xây dựng từ năm 1912 đến 1914. Với hơn 3.000 quầy hàng, đây là thiên đường mua sắm và ẩm thực của người Sài Gòn.',
      en: "Welcome to Ben Thanh Market. One of HCMC's oldest markets, built 1912–1914, with over 3,000 stalls of food, clothing, and souvenirs.",
      fr: null,
      ja: null,
      ko: null,
      zh: null,
    },
    mapLink: 'https://maps.google.com/?q=10.7724,106.6980',
    activationRadius: 100,
  },
  {
    id: 'war-museum',
    name: {
      vi: 'Bảo tàng Chứng tích Chiến tranh',
      en: 'War Remnants Museum',
      fr: 'Musée des Vestiges de Guerre',
      ja: '戦争証跡博物館',
      ko: '전쟁 잔재 박물관',
      zh: '战争遗迹博物馆',
    },
    category: 'Bảo tàng',
    address: '28 Võ Văn Tần, Phường 6, Quận 3, TP.HCM',
    lat: 10.7797,
    lng: 106.6923,
    coverImage:
      'https://images.unsplash.com/photo-1593449226006-3790edad4948?w=800&h=500&fit=crop&auto=format',
    shortDesc: {
      vi: 'Bảo tàng lịch sử chiến tranh Việt Nam được ghé thăm nhiều nhất',
      en: 'Most visited war history museum in Vietnam, est. 1975',
      fr: 'Le musée de guerre le plus visité du Vietnam',
      ja: '1975年設立、ベトナムで最も訪問される戦争博物館',
      ko: '1975년 설립, 베트남에서 가장 많이 방문하는 전쟁 박물관',
      zh: '越南参观人数最多的战争博物馆，成立于1975年',
    },
    description: {
      vi: 'Bảo tàng Chứng tích Chiến tranh là một trong những bảo tàng được ghé thăm nhiều nhất tại Việt Nam. Được thành lập năm 1975, bảo tàng lưu giữ và trưng bày các hiện vật, hình ảnh, tư liệu về cuộc chiến tranh Việt Nam. Các hiện vật bao gồm vũ khí, xe quân sự, máy bay chiến đấu cùng những bức ảnh ghi lại hậu quả của chiến tranh. Đây là nơi tưởng niệm và giáo dục về tầm quan trọng của hòa bình.',
      en: 'The War Remnants Museum is one of the most visited museums in Vietnam, established in 1975. It preserves artifacts, images, and documents related to the Vietnam War—weapons, military vehicles, fighter aircraft, and photographs documenting the consequences of war. It serves as a memorial and educational site about the importance of peace.',
      fr: "Le Musée des Vestiges de Guerre, établi en 1975, est l'un des plus visités du Vietnam. Il conserve des artefacts, images et documents liés à la guerre du Vietnam.",
      ja: '1975年に設立された戦争証跡博物館は、ベトナムで最も多く訪問される博物館の一つです。ベトナム戦争に関連する遺物、画像、文書を保存・展示しています。',
      ko: '1975년에 설립된 전쟁 잔재 박물관은 베트남에서 가장 많이 방문되는 박물관 중 하나입니다. 베트남 전쟁 관련 유물, 이미지, 문서를 보존·전시합니다.',
      zh: '战争遗迹博物馆成立于1975年，是越南参观人数最多的博物馆之一，保存并展示与越战相关的文物、图像和文件。',
    },
    ttsScript: {
      vi: 'Chào mừng bạn đến với Bảo tàng Chứng tích Chiến tranh. Được thành lập năm 1975, bảo tàng trưng bày các hiện vật, hình ảnh về cuộc chiến tranh Việt Nam, là nơi tưởng niệm và giáo dục về tầm quan trọng của hòa bình.',
      en: 'Welcome to the War Remnants Museum, established 1975. This is a memorial and educational site about the Vietnam War and the importance of peace.',
      fr: 'Bienvenue au Musée des Vestiges de Guerre. Établi en 1975, ce musée est un site commémoratif et éducatif sur la guerre du Vietnam.',
      ja: '戦争証跡博物館へようこそ。1975年設立のこの博物館は、ベトナム戦争と平和の重要性について学ぶ場所です。',
      ko: '전쟁 잔재 박물관에 오신 것을 환영합니다. 1975년 설립된 이 박물관은 베트남 전쟁과 평화의 중요성을 기념·교육하는 공간입니다.',
      zh: '欢迎来到战争遗迹博物馆。该博物馆成立于1975年，是纪念越战和平与教育的重要场所。',
    },
    mapLink: 'https://maps.google.com/?q=10.7797,106.6923',
    activationRadius: 100,
  },
  {
    id: 'opera-house',
    name: {
      vi: 'Nhà hát Thành phố Hồ Chí Minh',
      en: 'Ho Chi Minh City Opera House',
      fr: 'Opéra de Hô Chi Minh-Ville',
      ja: 'ホーチミン市市民劇場',
      ko: '호치민 시립 극장',
      zh: '胡志明市歌剧院',
    },
    category: 'Kiến trúc',
    address: '7 Công trường Lam Sơn, Bến Nghé, Quận 1, TP.HCM',
    lat: 10.7764,
    lng: 106.7034,
    coverImage:
      'https://images.unsplash.com/photo-1603852452440-b383ac720729?w=800&h=500&fit=crop&auto=format',
    shortDesc: {
      vi: 'Kiệt tác kiến trúc Baroque Pháp tại trái tim Sài Gòn',
      en: 'French Baroque masterpiece at the heart of Saigon, 1898–1900',
      fr: "Chef-d'œuvre baroque français au cœur de Saïgon",
      ja: null,
      ko: null,
      zh: null,
    },
    description: {
      vi: 'Nhà hát Thành phố Hồ Chí Minh là một kiệt tác kiến trúc Pháp tại trung tâm thành phố. Được xây dựng từ năm 1898 đến 1900, tòa nhà mang phong cách Baroque với các chi tiết trang trí tinh xảo. Hiện là địa điểm biểu diễn nghệ thuật và âm nhạc quan trọng của thành phố, nơi tổ chức nhiều chương trình ballet, opera và hòa nhạc đẳng cấp.',
      en: 'Ho Chi Minh City Opera House is a French architectural masterpiece in the city center. Built 1898–1900, the building features Baroque style with intricate decorative details. It is currently an important venue for performing arts and music, hosting ballet, opera, and concert performances.',
      fr: "L'Opéra de Hô Chi Minh-Ville est un chef-d'œuvre architectural français au centre-ville, construit entre 1898 et 1900 dans le style baroque. C'est aujourd'hui une salle de spectacle majeure.",
      ja: null,
      ko: null,
      zh: null,
    },
    ttsScript: {
      vi: 'Chào mừng bạn đến với Nhà hát Thành phố Hồ Chí Minh. Được xây dựng từ năm 1898 đến 1900, công trình kiến trúc Baroque Pháp này là một trong những tòa nhà đẹp nhất Sài Gòn và là trung tâm nghệ thuật biểu diễn hàng đầu thành phố.',
      en: 'Welcome to Ho Chi Minh City Opera House. Built 1898–1900, this French Baroque masterpiece is one of the most beautiful buildings in Saigon and a premier venue for performing arts.',
      fr: "Bienvenue à l'Opéra de Hô Chi Minh-Ville. Construit entre 1898 et 1900, ce chef-d'œuvre baroque est l'une des plus belles salles de spectacle de Saïgon.",
      ja: null,
      ko: null,
      zh: null,
    },
    mapLink: 'https://maps.google.com/?q=10.7764,106.7034',
    activationRadius: 100,
  },
  {
    id: 'nguyen-hue',
    name: {
      vi: 'Phố đi bộ Nguyễn Huệ',
      en: 'Nguyen Hue Walking Street',
      fr: 'Rue piétonne Nguyên Huê',
      ja: 'グエンフエ歩行者通り',
      ko: '응우옌 후에 보행자 거리',
      zh: '阮惠步行街',
    },
    category: 'Kiến trúc',
    address: 'Nguyễn Huệ, Bến Nghé, Quận 1, TP.HCM',
    lat: 10.7748,
    lng: 106.7013,
    coverImage:
      'https://images.unsplash.com/photo-1602479185069-cf2cfc4c463f?w=800&h=500&fit=crop&auto=format',
    shortDesc: {
      vi: 'Tuyến phố đi bộ sầm uất với quảng trường và đài phun nước',
      en: 'Bustling 670m pedestrian boulevard with plaza and fountains',
      fr: null,
      ja: null,
      ko: null,
      zh: null,
    },
    description: {
      vi: 'Phố đi bộ Nguyễn Huệ là tuyến đường đi bộ dài 670 mét chạy từ UBND Thành phố đến bến Bạch Đằng. Với quảng trường rộng rãi, đài phun nước và tượng Chủ tịch Hồ Chí Minh, đây là điểm tụ hội văn hóa và du lịch hàng đầu của TP.HCM. Hàng năm nơi đây tổ chức nhiều lễ hội, đặc biệt là đường hoa Nguyễn Huệ dịp Tết.',
      en: "Nguyen Hue Walking Street is a 670-meter pedestrian boulevard running from the City Hall to Bach Dang Wharf. With its spacious plaza, fountains, and Ho Chi Minh statue, it is HCMC's top cultural gathering point. The street hosts major festivals including the famous Nguyen Hue Flower Street during Tet.",
      fr: null,
      ja: null,
      ko: null,
      zh: null,
    },
    ttsScript: {
      vi: 'Chào mừng bạn đến với Phố đi bộ Nguyễn Huệ. Đây là tuyến đường đi bộ dài 670 mét, nơi tổ chức nhiều lễ hội và sự kiện văn hóa lớn của thành phố, đặc biệt là đường hoa Nguyễn Huệ vào dịp Tết Nguyên Đán.',
      en: 'Welcome to Nguyen Hue Walking Street. This 670-meter boulevard hosts major cultural events, especially the famous Nguyen Hue Flower Street during Lunar New Year.',
      fr: null,
      ja: null,
      ko: null,
      zh: null,
    },
    mapLink: 'https://maps.google.com/?q=10.7748,106.7013',
    activationRadius: 100,
  },
  {
    id: 'zoo',
    name: {
      vi: 'Thảo Cầm Viên Sài Gòn',
      en: 'Saigon Zoo and Botanical Gardens',
      fr: 'Zoo et Jardin Botanique de Saïgon',
      ja: 'サイゴン動植物園',
      ko: '사이공 동물원 및 식물원',
      zh: '西贡动植物园',
    },
    category: 'Công viên',
    address: '2 Nguyễn Bỉnh Khiêm, Bến Nghé, Quận 1, TP.HCM',
    lat: 10.7882,
    lng: 106.7049,
    coverImage:
      'https://images.unsplash.com/photo-1751346341346-f5b41cbc9e42?w=800&h=500&fit=crop&auto=format',
    shortDesc: {
      vi: 'Vườn bách thú và thực vật lâu đời nhất Đông Nam Á, 1864',
      en: 'One of the oldest zoos in Southeast Asia, established 1864',
      fr: null,
      ja: null,
      ko: null,
      zh: null,
    },
    description: {
      vi: 'Thảo Cầm Viên Sài Gòn là một trong những vườn bách thú và thực vật lâu đời nhất Đông Nam Á, được thành lập năm 1864. Tọa lạc trên diện tích 33 héc-ta, đây là nơi sinh sống của hơn 120 loài thực vật và 590 loài động vật. Ngoài ra còn có Bảo tàng Lịch sử Việt Nam, Đền thờ Hùng Vương và các khu vui chơi dành cho trẻ em.',
      en: 'Saigon Zoo and Botanical Gardens is one of the oldest zoological gardens in Southeast Asia, established in 1864. Covering 33 hectares, it is home to over 120 plant species and 590 animal species, plus the Vietnam History Museum and Hung Kings Temple.',
      fr: null,
      ja: null,
      ko: null,
      zh: null,
    },
    ttsScript: {
      vi: 'Chào mừng bạn đến với Thảo Cầm Viên Sài Gòn. Được thành lập năm 1864, đây là một trong những vườn bách thú lâu đời nhất Đông Nam Á với diện tích 33 héc-ta, là nơi sinh sống của hơn 590 loài động vật và 120 loài thực vật.',
      en: 'Welcome to Saigon Zoo and Botanical Gardens. Established in 1864, this is one of the oldest zoos in Southeast Asia, covering 33 hectares with over 590 animal and 120 plant species.',
      fr: null,
      ja: null,
      ko: null,
      zh: null,
    },
    mapLink: 'https://maps.google.com/?q=10.7882,106.7049',
    activationRadius: 150,
  },
];

export const DEMO_USER_LOCATIONS = {
  near: { lat: 10.772, lng: 106.6975 },
  far: { lat: 10.781, lng: 106.694 },
};

export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const f1 = (lat1 * Math.PI) / 180;
  const f2 = (lat2 * Math.PI) / 180;
  const df = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(df / 2) ** 2 + Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export const CATEGORY_COLORS: Record<Category, string> = {
  'Di tích': '#7c3aed',
  'Bảo tàng': '#b45309',
  'Tôn giáo': '#dc2626',
  'Kiến trúc': '#1d4ed8',
  'Công viên': '#15803d',
  'Ẩm thực': '#c2410c',
};

export const LANG_TO_SPEECH: Record<Language, string> = {
  vi: 'vi-VN',
  en: 'en-US',
  fr: 'fr-FR',
  ja: 'ja-JP',
  ko: 'ko-KR',
  zh: 'zh-CN',
};

export const QR_POI_MAP: Record<string, string> = {
  'VG-POST-OFFICE': 'post-office',
  'VG-CATHEDRAL': 'cathedral',
  'VG-IND-PALACE': 'independence-palace',
  'VG-BEN-THANH': 'ben-thanh',
  'VG-WAR-MUSEUM': 'war-museum',
  'VG-OPERA': 'opera-house',
  'VG-NGUYEN-HUE': 'nguyen-hue',
  'VG-ZOO': 'zoo',
};
