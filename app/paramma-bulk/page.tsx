"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import styles from "./page.module.css";

type Category = "신기한 동물이야기" | "신비로운 자연" | "생활 속 궁금증" | "신기한 우리 몸";
type Status = "waiting" | "working" | "done";
type SlotStatus = "waiting" | "working" | "registered";
type SlotId = "00" | "01" | "02" | "03";

type SlotMeta = {
  status: SlotStatus;
  prompt: string;
  width?: number;
  height?: number;
  warning?: string;
  updatedAt?: string;
};

type TopicWork = {
  articlePrompt: string;
  body: string;
  bodyConfirmed: boolean;
  optional03: boolean;
  slots: Record<SlotId, SlotMeta>;
};

type ImageRecord = { blob: Blob; width: number; height: number; updatedAt: string };
type LoadedImage = ImageRecord & { url: string };
type NaverBlock = {
  type: "title" | "subheading" | "body" | "image" | "tags";
  text: string;
};

type Topic = {
  id: number;
  category: Category;
  title: string;
  thumbnailHook: string;
  brief: string;
};

type TopicSeed = Omit<Topic, "id">;
type ParammaHistoryItem = {
  normalized_key: string;
  title: string;
  category: Category;
  thumbnail_hook: string | null;
  published_on: string;
};

const TOPICS: Topic[] = [
  { id: 1, category: "생활 속 궁금증", title: "사과를 잘라 두면 갈색으로 변하는 이유, 상한 걸까?", thumbnailHook: "갈색 사과, 상한 걸까?", brief: "사과를 자른 뒤 시간이 지나면 갈색으로 변하는 현상을 산소와 효소가 관여하는 갈변 과정으로 풀고, 단순 변색과 실제 부패의 차이까지 생활 눈높이에서 설명하는 소재입니다." },
  { id: 2, category: "신기한 동물이야기", title: "거미줄은 끈끈한데 거미는 어떻게 자유롭게 걸을까?", thumbnailHook: "거미는 왜 안 붙지?", brief: "끈끈한 거미줄 위에서도 거미가 자유롭게 움직이는 이유를 거미줄의 종류와 발의 접촉 방식, 이동 행동을 중심으로 설명하는 동물 호기심 소재입니다." },
  { id: 3, category: "신기한 우리 몸", title: "배에서 ‘꼬르륵’ 소리는 대체 어디서 나는 걸까?", thumbnailHook: "배 속에서 무슨 소리지?", brief: "배고플 때나 식사 전후에 나는 꼬르륵 소리가 어디에서 생기는지 위장관의 움직임과 공기·액체의 이동을 중심으로 설명하는 생활 밀착형 우리 몸 소재입니다." },
  { id: 4, category: "생활 속 궁금증", title: "안전벨트는 천천히 당기면 나오는데 확 당기면 멈추는 이유", thumbnailHook: "갑자기 당기면 딱 멈춘다?", brief: "자동차 안전벨트가 평소에는 부드럽게 풀리지만 급하게 당길 때 잠기는 원리를 관성식 잠금장치와 릴 구조를 중심으로 쉽게 설명하는 생활 장치 소재입니다." },
  { id: 5, category: "신비로운 자연", title: "무지개는 사실 동그랗다? 땅에서는 반원만 보이는 이유", thumbnailHook: "무지개가 원이라고?", brief: "우리가 땅에서 무지개를 주로 반원처럼 보는 이유와 높은 곳에서는 더 큰 원호나 원형에 가까운 무지개가 보일 수 있는 원리를 빛의 굴절·반사와 관찰 위치로 설명하는 자연 소재입니다." },
  { id: 6, category: "생활 속 궁금증", title: "밥을 냉장고에 넣으면 딱딱해지는 이유, 수분이 말라서일까?", thumbnailHook: "냉장밥은 왜 딱딱하지?", brief: "냉장 보관한 밥이 빠르게 딱딱해지는 현상을 단순한 수분 손실만이 아니라 전분의 노화와 구조 변화까지 연결해 설명하는 한국 생활 밀착형 소재입니다." },
  { id: 7, category: "신기한 동물이야기", title: "새는 나뭇가지에서 자다가 어떻게 안 떨어질까?", thumbnailHook: "자다가 안 떨어질까?", brief: "새가 나뭇가지에 앉아 잠들어도 쉽게 떨어지지 않는 이유를 발가락과 힘줄의 구조, 앉는 자세와 종별 차이를 중심으로 설명하는 동물 소재입니다." },
  { id: 8, category: "신기한 우리 몸", title: "한쪽 콧구멍이 막혔다가 반대쪽이 막히는 느낌, 착각일까?", thumbnailHook: "콧구멍이 번갈아 막힌다?", brief: "양쪽 콧구멍의 공기 흐름이 시간에 따라 달라지는 정상적인 비강 주기를 소개하고, 코막힘처럼 느껴지는 이유를 과장 없이 설명하는 우리 몸 생활형 소재입니다." },
  { id: 9, category: "신비로운 자연", title: "바닷가 파도는 누가 계속 밀어오는 걸까?", thumbnailHook: "파도는 어디서 오는 걸까?", brief: "바닷가에 파도가 끊임없이 들어오는 모습을 출발점으로 바람이 만든 에너지가 물결로 전달되고 멀리 이동해 해안에 도달하는 과정을 쉽게 설명하는 자연 소재입니다." },
  { id: 10, category: "생활 속 궁금증", title: "유리컵에 뜨거운 물을 부었더니 ‘쩍’… 가끔 깨지는 이유", thumbnailHook: "뜨거운 물에 왜 깨졌지?", brief: "차가운 유리컵에 뜨거운 물을 부었을 때 깨질 수 있는 이유를 유리 안팎의 급격한 온도 차와 열팽창·열응력으로 설명하고 안전하게 사용할 때의 기본 원칙까지 연결하는 생활 과학 소재입니다." },
]

const TOPIC_POOL: TopicSeed[] = [
  { category: "생활 속 궁금증", title: "금속 숟가락은 왜 나무젓가락보다 더 차갑게 느껴질까?", thumbnailHook: "같은 방에 있었는데 왜 더 차갑지?", brief: "같은 온도에 있던 금속과 나무가 손에 닿을 때 다르게 느껴지는 이유를 열전도율과 피부의 열 이동으로 설명하는 생활 과학 소재입니다." },
  { category: "신기한 동물이야기", title: "고양이 수염은 왜 그렇게 길고 민감할까?", thumbnailHook: "수염으로 뭘 느끼는 걸까?", brief: "고양이 수염이 단순한 털이 아니라 주변 공간과 접촉을 감지하는 감각 구조라는 점을 행동과 해부학 중심으로 설명하는 소재입니다." },
  { category: "신기한 우리 몸", title: "하품은 왜 옆 사람에게도 옮는 것처럼 느껴질까?", thumbnailHook: "하품은 정말 전염될까?", brief: "다른 사람의 하품을 보거나 떠올릴 때 하품이 유발될 수 있는 현상을 연구 결과와 함께 설명하고 확실한 점과 아직 논의 중인 부분을 구분하는 우리 몸 소재입니다." },
  { category: "신비로운 자연", title: "별은 왜 밤하늘에서 반짝이는 것처럼 보일까?", thumbnailHook: "별빛은 왜 깜빡일까?", brief: "별 자체가 빠르게 밝아졌다 어두워지는 것이 아니라 대기층을 통과한 빛이 흔들려 보이는 원리를 쉽게 설명하는 자연 소재입니다." },
  { category: "생활 속 궁금증", title: "지우개는 어떻게 연필 자국만 지울 수 있을까?", thumbnailHook: "지우개는 글씨를 어디로 없앨까?", brief: "연필 흑연 입자와 종이 섬유, 지우개의 마찰과 점착 작용을 연결해 글씨가 지워지는 과정을 설명하는 생활 소재입니다." },
  { category: "신기한 동물이야기", title: "강아지는 더울 때 왜 혀를 내밀고 헐떡일까?", thumbnailHook: "왜 혀를 내밀고 헥헥할까?", brief: "개가 체온을 조절할 때 헐떡임과 호흡기 표면의 증발이 어떤 역할을 하는지 사람의 땀과 비교해 설명하는 동물 소재입니다." },
  { category: "신비로운 자연", title: "눈송이는 왜 대부분 여섯 갈래 모양일까?", thumbnailHook: "눈송이는 왜 6각형일까?", brief: "물 분자의 결정 구조와 얼음 결정이 자라는 조건을 연결해 눈 결정에 육각 대칭이 나타나는 이유를 설명하는 겨울 검색형 소재입니다." },
  { category: "생활 속 궁금증", title: "자동문은 사람이 다가오는 걸 어떻게 알아챌까?", thumbnailHook: "자동문은 나를 어떻게 알까?", brief: "자동문의 감지 방식이 모두 같은 것은 아니라는 점을 전제로, 모션·적외선·존재 감지 센서의 기본 원리를 생활 눈높이에서 설명하는 소재입니다." },
  { category: "신기한 우리 몸", title: "비행기를 타면 귀가 먹먹해지는 이유는 뭘까?", thumbnailHook: "비행기에서 귀가 왜 먹먹하지?", brief: "고도 변화에 따른 기압 차와 중이의 압력 조절을 연결해 귀가 먹먹하거나 뻐근해지는 이유를 설명하는 우리 몸 소재입니다." },
  { category: "신기한 동물이야기", title: "오리는 물에 떠 있어도 깃털이 왜 쉽게 젖지 않을까?", thumbnailHook: "물속인데 깃털은 왜 멀쩡하지?", brief: "오리의 깃털 구조와 깃털 손질, 기름샘의 역할을 과장 없이 구분해 방수성이 유지되는 이유를 설명하는 동물 소재입니다." },
  { category: "생활 속 궁금증", title: "얼음은 단단한데 왜 물 위에 뜰까?", thumbnailHook: "얼음은 왜 가라앉지 않을까?", brief: "물이 얼면서 분자 배열이 달라지고 밀도가 낮아지는 특성을 이용해 얼음이 액체 물 위에 뜨는 이유를 설명하는 생활 과학 소재입니다." },
  { category: "신비로운 자연", title: "안개와 구름은 뭐가 다를까? 둘 다 작은 물방울인데", thumbnailHook: "안개도 구름일까?", brief: "안개와 구름이 모두 미세한 물방울이나 얼음 입자로 이루어질 수 있지만 형성 위치와 관측 방식이 어떻게 다른지 설명하는 자연 소재입니다." },
  { category: "신기한 우리 몸", title: "딸꾹질은 왜 갑자기 시작되고 ‘딸꾹’ 소리가 날까?", thumbnailHook: "딸꾹 소리는 어디서 날까?", brief: "횡격막의 불수의적 수축과 성문이 닫히며 나는 소리를 연결해 딸꾹질의 기본 원리를 설명하는 우리 몸 소재입니다." },
  { category: "생활 속 궁금증", title: "지퍼는 어떻게 양쪽 이빨을 한 번에 맞물리게 할까?", thumbnailHook: "지퍼 하나가 어떻게 딱 맞물릴까?", brief: "슬라이더의 좁아지는 통로가 지퍼 요소를 정렬하고 맞물리게 하는 기계적 구조를 일상 물건 관찰로 설명하는 소재입니다." },
  { category: "신기한 동물이야기", title: "박쥐는 왜 거꾸로 매달려 쉬는 걸까?", thumbnailHook: "왜 굳이 거꾸로 매달릴까?", brief: "박쥐의 다리와 발 구조, 이륙 방식과 휴식 자세를 연결해 거꾸로 매달리는 생활 방식의 이유를 설명하는 동물 소재입니다." },
  { category: "신비로운 자연", title: "바람은 보이지 않는데 대체 어디서 생기는 걸까?", thumbnailHook: "바람은 누가 만드는 걸까?", brief: "지표의 불균등한 가열이 기압 차를 만들고 공기가 이동하는 기본 과정을 중심으로 바람의 출발점을 설명하는 자연 소재입니다." },
  { category: "생활 속 궁금증", title: "냉동실 벽에 하얀 성에는 왜 자꾸 생길까?", thumbnailHook: "냉동실 눈꽃은 어디서 왔을까?", brief: "공기 중 수증기가 차가운 표면에서 얼어붙는 과정과 문을 자주 열 때 성에가 늘 수 있는 이유를 설명하는 생활 소재입니다." },
  { category: "신기한 우리 몸", title: "눈물이 나면 왜 콧물도 같이 흐를까?", thumbnailHook: "울면 코까지 막히는 이유", brief: "눈물이 코 쪽으로 배출되는 눈물길의 구조를 중심으로 울 때 콧물이 늘거나 코가 막히는 느낌이 생기는 이유를 설명하는 우리 몸 소재입니다." },
  { category: "신기한 동물이야기", title: "물고기 떼는 어떻게 부딪히지 않고 동시에 방향을 바꿀까?", thumbnailHook: "누가 신호를 보내는 걸까?", brief: "물고기 떼가 주변 개체의 위치와 움직임에 반응하며 집단 방향을 바꾸는 행동을 감각 기관과 군집 행동 연구로 설명하는 소재입니다." },
  { category: "생활 속 궁금증", title: "뜨거운 물에 병뚜껑을 데우면 왜 더 잘 열릴까?", thumbnailHook: "뜨거운 물이면 뚜껑이 왜 풀릴까?", brief: "재료의 열팽창과 뚜껑·용기 사이의 마찰 변화를 이용해 금속 뚜껑이 더 쉽게 열릴 수 있는 이유를 설명하는 생활 과학 소재입니다." },
  { category: "신비로운 자연", title: "태풍의 눈은 왜 주변보다 비교적 고요할까?", thumbnailHook: "태풍 한가운데가 조용하다고?", brief: "강한 태풍에서 눈과 눈벽의 구조가 어떻게 다른지, 중심부에 상대적으로 약한 바람 구역이 생기는 이유를 설명하는 자연 소재입니다." },
  { category: "신기한 우리 몸", title: "잠들기 직전에 몸이 갑자기 움찔하는 건 왜 그럴까?", thumbnailHook: "잠들다 왜 갑자기 움찔하지?", brief: "잠으로 넘어가는 과정에서 나타날 수 있는 수면 시작 경련을 정상 범위의 현상으로 설명하고 개인차를 함께 짚는 우리 몸 소재입니다." },
  { category: "생활 속 궁금증", title: "연필은 잉크도 없는데 어떻게 종이에 글씨가 써질까?", thumbnailHook: "연필 속엔 잉크가 없는데?", brief: "연필심의 흑연 입자가 종이 표면에 묻어 흔적을 남기는 원리를 재료와 마찰 관점에서 설명하는 생활 소재입니다." },
  { category: "신기한 동물이야기", title: "펭귄은 얼음 위에 오래 서 있어도 발이 왜 버틸 수 있을까?", thumbnailHook: "펭귄 발은 안 시릴까?", brief: "펭귄 다리의 혈류 조절과 열교환 구조가 열 손실을 줄이는 데 어떻게 도움을 주는지 설명하는 동물 소재입니다." },
  { category: "신비로운 자연", title: "우박은 더운 여름에도 어떻게 얼음으로 떨어질까?", thumbnailHook: "한여름에 얼음이 떨어진다고?", brief: "적란운 안의 강한 상승기류와 차가운 상층 대기에서 얼음 알갱이가 성장하는 과정을 설명하는 계절형 자연 소재입니다." },
  { category: "생활 속 궁금증", title: "스테인리스는 왜 다른 철보다 녹이 잘 안 슬까?", thumbnailHook: "스테인리스는 정말 안 녹을까?", brief: "크롬이 포함된 합금 표면에 보호막이 형성되는 원리를 설명하고 '절대 녹슬지 않는다'는 오해도 함께 바로잡는 소재입니다." },
  { category: "신기한 우리 몸", title: "머리카락과 손톱은 잘라도 왜 아프지 않을까?", thumbnailHook: "잘라도 왜 하나도 안 아플까?", brief: "머리카락과 손톱의 바깥 부분이 주로 각질화된 세포로 이루어져 있다는 점을 살아 있는 조직과 비교해 설명하는 우리 몸 소재입니다." },
  { category: "신기한 동물이야기", title: "개구리는 울 때 목 아래가 왜 풍선처럼 부풀까?", thumbnailHook: "목에 풍선이 달린 걸까?", brief: "일부 개구리의 울음주머니가 소리를 증폭하고 전달하는 데 어떤 역할을 하는지 종별 차이를 포함해 설명하는 동물 소재입니다." },
  { category: "생활 속 궁금증", title: "젖은 종이는 왜 마른 종이보다 훨씬 쉽게 찢어질까?", thumbnailHook: "물만 묻었는데 왜 약해질까?", brief: "종이 섬유 사이 결합에 물이 영향을 주면서 강도가 달라지는 이유를 일상 재료 관점에서 설명하는 소재입니다." },
  { category: "신비로운 자연", title: "달이 지평선 근처에서 유난히 커 보이는 건 진짜일까?", thumbnailHook: "오늘 달이 왜 이렇게 크지?", brief: "지평선 가까운 달이 실제 크기 변화보다 크게 느껴지는 달 착시 현상을 관찰과 인지 관점에서 설명하는 자연 소재입니다." },
  { category: "신기한 우리 몸", title: "귀지는 왜 계속 생길까? 꼭 없애야 하는 걸까?", thumbnailHook: "귀지는 대체 왜 생길까?", brief: "외이도 피부와 분비물이 귀지를 만드는 과정과 귀지가 갖는 기본적인 보호 역할을 설명하되 개인 진료 조언으로 이어지지 않게 구성하는 우리 몸 소재입니다." },
  { category: "생활 속 궁금증", title: "풍선을 머리카락에 문지르면 왜 달라붙을까?", thumbnailHook: "풍선이 머리카락을 끌어당긴다?", brief: "마찰로 전하가 이동하고 정전기력이 생기는 과정을 풍선과 머리카락의 친숙한 실험으로 설명하는 생활 과학 소재입니다." },
  { category: "신기한 동물이야기", title: "토끼 귀는 왜 몸에 비해 그렇게 길까?", thumbnailHook: "큰 귀에는 이유가 있을까?", brief: "긴 귀가 청각뿐 아니라 일부 종에서 체열 조절에도 도움을 줄 수 있다는 점을 서식 환경과 함께 설명하는 동물 소재입니다." },
  { category: "신비로운 자연", title: "서리는 비도 안 왔는데 아침에 어떻게 생길까?", thumbnailHook: "밤새 누가 하얗게 뿌렸을까?", brief: "맑고 추운 밤 표면 온도가 내려가면서 수증기가 얼음 결정으로 달라붙는 서리 형성 과정을 설명하는 계절 검색형 소재입니다." },
  { category: "생활 속 궁금증", title: "소금을 뿌리면 얼음이 더 빨리 녹는 이유는 뭘까?", thumbnailHook: "소금이 얼음을 녹인다고?", brief: "소금이 물의 어는점을 낮추는 현상을 겨울철 제설과 연결해 설명하되 온도 조건에 따른 한계도 함께 짚는 생활 소재입니다." },
  { category: "신기한 우리 몸", title: "땀이 마르면 왜 피부가 시원해질까?", thumbnailHook: "땀이 식혀주는 원리는 뭘까?", brief: "땀이 증발할 때 피부에서 열에너지를 가져가는 과정을 체온 조절과 연결해 설명하는 우리 몸 소재입니다." },
  { category: "신기한 동물이야기", title: "고양이는 높은 곳에서 떨어질 때 어떻게 몸을 돌릴까?", thumbnailHook: "공중에서 몸을 돌린다고?", brief: "고양이의 바로잡기 반사와 몸통 회전, 낙하 자세를 설명하되 높은 곳 추락이 안전하다는 오해는 피하는 동물 소재입니다." },
  { category: "생활 속 궁금증", title: "종이컵은 종이인데 뜨거운 물을 담아도 왜 바로 새지 않을까?", thumbnailHook: "종이인데 왜 물이 안 샐까?", brief: "종이컵 안쪽의 얇은 코팅층이 액체가 종이 섬유로 스며드는 것을 늦추는 원리를 설명하는 생활 소재입니다." },
  { category: "신비로운 자연", title: "산 위로 올라가면 왜 평지보다 기온이 낮아질까?", thumbnailHook: "높이 올라가면 왜 추워질까?", brief: "고도가 높아질수록 기압이 낮아지고 상승한 공기가 팽창하며 냉각되는 기본 원리를 설명하는 자연 소재입니다." },
  { category: "신기한 우리 몸", title: "매운 음식을 먹으면 왜 콧물과 땀이 같이 날까?", thumbnailHook: "매운데 왜 코까지 반응할까?", brief: "매운맛 성분이 감각 신경을 자극하면서 땀과 콧물 같은 반응이 나타날 수 있는 이유를 쉽게 설명하는 우리 몸 소재입니다." }
];

const STORAGE_KEY = "paramma-publish-queue-v5";
const DB_NAME = "paramma-blogger-images-v5";
const DB_STORE = "images";
const SLOT_IDS: SlotId[] = ["00", "01", "02", "03"];
const SLOT_INFO: Record<SlotId, { label: string; role: string; width: number; height: number; filename: string; copy: string }> = {
  "00": { label: "썸네일", role: "대표 썸네일", width: 1254, height: 1254, filename: "00_thumbnail.png", copy: "주제를 한눈에 이해시키는 질문형 썸네일" },
  "01": { label: "본문 이미지 01", role: "핵심 원리", width: 1600, height: 900, filename: "01_body.png", copy: "핵심 원리를 한눈에 이해시키는 장면" },
  "02": { label: "본문 이미지 02", role: "과정·비교", width: 1600, height: 900, filename: "02_body.png", copy: "원인과 과정 또는 비교를 쉽게 보여주는 장면" },
  "03": { label: "선택 이미지 03", role: "추가 설명", width: 1600, height: 900, filename: "03_body.png", copy: "추가로 알아두면 좋은 점을 보여주는 보조 장면" },
};

function categoryEmoji(category: Category) {
  if (category === "신기한 동물이야기") return "🐾";
  if (category === "신비로운 자연") return "🌌";
  if (category === "신기한 우리 몸") return "🧠";
  return "💡";
}

function categoryClass(category: Category) {
  if (category === "신기한 동물이야기") return styles.animal;
  if (category === "신비로운 자연") return styles.nature;
  if (category === "신기한 우리 몸") return styles.body;
  return styles.life;
}

function formatToday() {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function categoryGuide(category: Category) {
  if (category === "신기한 동물이야기") {
    return "동물의 행동이나 능력을 사람처럼 과도하게 의인화하지 말고, 관찰 연구와 생물학적 원인을 중심으로 설명한다. 독자가 놀랄 만한 포인트는 살리되 검증되지 않은 능력은 사실처럼 쓰지 않는다.";
  }
  if (category === "신비로운 자연") {
    return "현상이 왜 생기는지 원인→과정→결과 순서로 쉽게 설명한다. 사진이나 영상에서 강하게 보이는 현상일수록 과장·도시전설·잘못된 설명을 구분해 검증한다.";
  }
  if (category === "신기한 우리 몸") {
    return "우리 몸에서 실제로 일어나는 생리학적 원인을 중심으로 쉽게 설명한다. 질환 진단이나 과장된 건강 효과로 연결하지 말고, 건강·의학 관련 내용은 정부기관·대학병원·의학 학회·논문 등 신뢰할 수 있는 자료를 우선 확인한다. 개인차가 큰 내용은 모든 사람에게 똑같이 나타나는 것처럼 단정하지 않는다.";
  }
  return "독자가 검색한 질문에 초반 3~4문장 안에 핵심 답을 먼저 준다. 생활에서 실제로 체감하는 이유와 과학적 원리를 연결하고, 건강·안전 관련 내용은 공공기관 자료를 우선 확인한다.";
}

function cleanNaverLine(line: string) {
  return line
    .replace(/^#{1,6}\s+/, "")
    .replace(/^\*\*(.*?)\*\*$/, "$1")
    .replace(/^__(.*?)__$/, "$1")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\\#/g, "#")
    .trim();
}

function isNonPublishNaverHeading(line: string) {
  const normalized = cleanNaverLine(line)
    .replace(/^\[|\]$/g, "")
    .replace(/^\d+[.)]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();

  return /^(이미지.*기획\s*메모|검수\s*메모)(?:\s*[:：-].*)?$/i.test(normalized);
}

function parseNaverBlog(raw: string): NaverBlock[] {
  const allLines = raw.replace(/\r\n?/g, "\n").split("\n");
  const cutoff = allLines.findIndex((line) => isNonPublishNaverHeading(line));
  const publishLines = cutoff >= 0 ? allLines.slice(0, cutoff) : allLines;

  const lines = publishLines
    .map((line) => line.trim())
    .filter((line) => line && !/^:::writing\b/i.test(line) && line !== ":::" && !/^---option\b/i.test(line));

  if (!lines.length) return [];

  const blocks: NaverBlock[] = [];
  let firstContent = true;

  for (const original of lines) {
    const line = cleanNaverLine(original);
    if (!line) continue;

    if (firstContent) {
      blocks.push({ type: "title", text: line });
      firstContent = false;
      continue;
    }

    const hashtagCount = (line.match(/#[^\s#]+/g) || []).length;
    if (hashtagCount >= 2 && line.startsWith("#")) {
      blocks.push({ type: "tags", text: line });
      continue;
    }

    if (/^\[이미지\s*\d+/i.test(line)) {
      blocks.push({ type: "image", text: line });
      continue;
    }

    const markdownHeading = /^#{2,6}\s+/.test(original);
    const wholeBold = /^(\*\*|__)[\s\S]+\1$/.test(original);
    const emojiHeading = /^[🐾🌌💡🧠✅📌🔎]/u.test(line) && line.length <= 40 && !/[.!?]$/.test(line);

    if (markdownHeading || wholeBold || emojiHeading) {
      blocks.push({ type: "subheading", text: line });
      continue;
    }

    blocks.push({ type: "body", text: line });
  }

  return blocks;
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function naverPlainText(blocks: NaverBlock[]) {
  return blocks.map((block) => block.text).join("\r\n \r\n");
}

function naverRichHtml(blocks: NaverBlock[]) {
  const font = "'Nanum Gothic','Noto Sans KR','Apple SD Gothic Neo',Arial,sans-serif";
  const blockHtml = blocks.map((block) => {
    const safe = escapeHtml(block.text);
    if (block.type === "title") {
      return `<div style="font-family:${font};font-size:20pt;line-height:1.5;font-weight:700;margin:0;">${safe}</div>`;
    }
    if (block.type === "subheading") {
      return `<div style="font-family:${font};font-size:18pt;line-height:1.55;font-weight:700;margin:0;">${safe}</div>`;
    }
    if (block.type === "tags") {
      return `<div style="font-family:${font};font-size:13.5pt;line-height:1.6;font-weight:400;margin:0;">${safe}</div>`;
    }
    if (block.type === "image") {
      return `<div style="font-family:${font};font-size:15pt;line-height:1.6;font-weight:600;margin:0;">${safe}</div>`;
    }
    return `<div style="font-family:${font};font-size:15pt;line-height:1.7;font-weight:400;margin:0;">${safe}</div>`;
  });

  const spacer = `<div style="font-family:${font};font-size:15pt;line-height:1.7;margin:0;"><br></div>`;
  return `<div>${blockHtml.join(spacer)}</div>`;
}

function buildArticlePrompt(topic: Topic) {
  return `Paramma 블로거 네이버 글을 최종 발행본으로 만들어줘.

[작성 기준일]
${formatToday()}

[발행 정보]
발행 큐: 상시 10개
큐 위치: ${topic.id}/10
카테고리: ${topic.category}
주제: ${topic.title}
기획 의도: ${topic.brief}
썸네일 후킹 문구: ${topic.thumbnailHook}

[가장 중요한 작업 방식]
- 먼저 웹 검색으로 사실을 확인한 뒤 글을 작성할 것.
- 현재·계절성 내용은 작성 기준일과 맞는 최신 자료를 우선 확인할 것.
- 정부기관, 대학, 학술논문, 박물관·과학기관, 공신력 있는 전문기관을 우선 활용할 것.
- 블로그나 커뮤니티의 주장을 그대로 사실처럼 사용하지 말 것.
- 서로 다른 설명이 있는 내용은 무엇이 확실하고 무엇이 가설인지 구분할 것.
- 숫자·기간·온도·생태 특징 등 구체적인 사실은 임의로 만들지 말 것.
- 검색 결과를 그대로 베끼지 말고 이해하기 쉬운 한국어로 재구성할 것.

[카테고리 작성 규칙]
${categoryGuide(topic.category)}

[네이버 검색형 제목]
- 제목 후보 5개를 먼저 내부적으로 비교할 것.
- 최종 제목은 검색어가 자연스럽게 들어가면서도 “왜/어떻게/정말?” 같은 궁금증을 살릴 것.
- AI 검색 요약과 네이버 홈에서 주제가 즉시 이해되도록 핵심 명사를 앞쪽에 자연스럽게 둘 것.
- 낚시성 과장, 사실과 다른 단정, 지나치게 긴 제목은 피할 것.
- 본문 최종 출력에서는 최종 선택 제목 1개만 맨 위에 표시할 것.
- 썸네일 문구는 제공된 “${topic.thumbnailHook}”을 기본으로 사용하고, 본문 제목 전체를 썸네일에 반복하지 말 것.

[본문 구성]
- 모바일에서 읽기 편하게 짧은 문단으로 작성.
- 도입부에서 독자의 실제 궁금증을 바로 꺼낼 것.
- 핵심 답을 너무 늦게 숨기지 말 것.
- 소제목 4~6개 정도.
- 핵심 원리와 과정을 쉬운 말로 설명.
- 사람들이 자주 오해하는 부분이 있으면 별도 문단으로 바로잡기.
- 같은 말을 반복해 분량만 늘리지 말 것.
- AI가 쓴 티가 나는 상투적인 결론은 피할 것.
- 정보글이지만 딱딱한 논문체보다는 자연스러운 개인 블로그 문체.
- 필요하면 마지막에 ‘한눈에 정리’ 3줄 정도 사용.
- 네이버 블로그용 태그 8~12개를 마지막에 한 줄로 제공.

[이미지 기획 메모]
최종 본문 안에 이미지 위치를 정확히 표시해줘.
- 이미지 00: 썸네일
- 이미지 01: 핵심 원리 또는 가장 이해가 필요한 장면
- 이미지 02: 과정·비교·구조를 보여주는 장면
- 이미지 03은 내용상 꼭 필요할 때만 제안
- 각 이미지가 무엇을 보여주면 좋은지 한 줄씩 기획 메모만 작성
- 실제 이미지 생성 요청서는 콘텐츠메이커의 이미지 슬롯에서 별도로 만들므로 여기서는 긴 이미지 프롬프트를 반복하지 말 것

[최종 출력 순서]
1. 최종 제목
2. 네이버 발행용 본문
3. 태그
4. 이미지 00~02(필요 시 03) 기획 메모
5. 마지막에 ‘검수 메모’로 사용한 주요 출처와 핵심 사실을 짧게 정리

중요: 검색하지 않고 일반 상식만으로 작성하지 말고, 반드시 최신 웹 검색과 사실 검증을 거쳐 완성해줘.`;
}


function buildLegacyImagePrompt(topic: Topic, slotId: SlotId) {
  const info = SLOT_INFO[slotId];
  const ratio = info.width === info.height ? "1:1 정사각형" : "16:9 가로형";
  const textLine = slotId === "00" ? topic.title : info.copy;
  return `Paramma 블로거용 이미지를 1장 만들어줘.

[글 정보]
카테고리: ${topic.category}
글 주제: ${topic.title}
기획 의도: ${topic.brief}

[이미지 역할]
슬롯: ${slotId} · ${info.label}
역할: ${info.role}
이 이미지가 전달할 내용: ${info.copy}

[제작 목표]
목표 크기: ${info.width}×${info.height}px
목표 비율: ${ratio}
네이버 블로그용 단일 이미지 1장

[공통 스타일]
- 실제 블로그 운영자가 직접 편집한 것처럼 자연스럽고 신뢰감 있게
- 과도한 AI 느낌, 네온, 유리질감, 과한 3D 효과, 불필요한 장식 금지
- 실제 생물·자연·인체의 형태와 색을 과장하거나 왜곡하지 말 것
- 설명형이면 교육용 인포그래픽처럼 구조가 한눈에 보이게
- 사진형이 적합하면 자연 다큐멘터리 사진처럼 사실적으로
- 모바일에서도 핵심 피사체가 잘 보이도록 단순한 구도와 여백 사용

[이미지에 넣을 문구]
${textLine}
- 위 문구 외에 긴 설명문을 추가하지 말 것
- 한글 문구는 짧고 크게, 오탈자 없이 표시할 것

[제외할 요소]
- 워터마크, 타사 로고
- 출처 불명 숫자·통계
- 본문에서 확인되지 않은 사실
- 여러 장을 한 장에 합친 콜라주
- 작은 글자를 빽빽하게 채운 구성

중요: 다른 채팅에 이 요청서만 단독으로 붙여넣어도 바로 제작할 수 있게 필요한 정보를 모두 포함했다.`;
}

function buildImagePrompt(topic: Topic, slotId: SlotId) {
  const info = SLOT_INFO[slotId];
  const isThumbnail = slotId === "00";
  const ratio = info.width === info.height ? "1:1 정사각형" : "16:9 가로형";

  const compositionRules = isThumbnail
    ? `[썸네일 구성 원칙]
- 주제를 한눈에 이해시키는 대표 썸네일로 구성
- 핵심 피사체와 질문형 문구가 모바일 목록에서도 바로 보이게
- 문구는 1~2줄 중심으로 크게 배치
- 정보 과밀 없이 강한 대표 장면 1개를 중심으로 구성

[이미지에 넣을 문구]
${topic.thumbnailHook}
- 위 문구를 메인 후킹 문구로 사용할 것
- 본문 제목 전체를 다시 적지 말 것
- 긴 설명문을 추가하지 말 것
- 네이버 홈 목록에서 1초 안에 읽히도록 한글 문구는 1~2줄로 크고 선명하게, 오탈자 없이 표시할 것`
    : `[본문 이미지 구성 원칙]
- 이 이미지는 썸네일이 아니라 글 중간에 삽입되는 본문용 이미지
- 이미지 상단이나 중앙에 주제 전체를 반복하는 큰 제목·질문형 메인 카피만 넣지 말 것
- 화면의 중심은 실제 장면·생물·자연 현상·과정 자체가 되게 할 것
- 사진형이 적합하면 자연 다큐멘터리 사진처럼 사실적인 한 장면으로 구성
- 설명형이면 원인·과정·비교를 쉽게 이해하도록 짧은 라벨, 원형 설명 요소, 화살표를 자연스럽게 사용할 수 있음
- 여러 설명 요소를 사용해도 전체가 광고 썸네일이 아니라 본문 설명 이미지처럼 보이게 할 것
- 여백은 자연스럽게 두고 블로그 본문에 넣었을 때 설명 이미지/삽화처럼 보이게 할 것

[이미지 내 텍스트]
- 주제 전체를 반복하는 큰 헤드라인은 넣지 말 것
- 원인·과정·비교를 설명하는 짧은 라벨은 1~4개 정도 허용
- 필요한 경우 화살표와 단계 문구를 함께 사용 가능
- 설명 라벨은 읽기 쉽게 표시하되 메인 제목처럼 크게 만들지 말 것`;

  return `Paramma 블로거용 이미지를 1장 만들어줘.

[글 정보]
카테고리: ${topic.category}
글 주제: ${topic.title}
기획 의도: ${topic.brief}

[이미지 역할]
슬롯: ${slotId} · ${info.label}
역할: ${info.role}
이 이미지가 전달할 내용: ${info.copy}

[제작 목표]
목표 크기: ${info.width}×${info.height}px
목표 비율: ${ratio}
네이버 블로그용 단일 이미지 1장

[공통 스타일]
- 실제 블로그 운영자가 직접 편집한 것처럼 자연스럽고 신뢰감 있게
- 과도한 AI 느낌, 네온, 유리질감, 과한 3D 효과, 불필요한 장식 금지
- 실제 생물·자연·인체의 형태와 색을 과장하거나 왜곡하지 말 것
- 모바일에서도 핵심 피사체가 잘 보이도록 단순한 구도와 여백 사용

${compositionRules}

[제외할 요소]
- 워터마크, 타사 로고
- 출처 불명 숫자·통계
- 본문에서 확인되지 않은 사실
- 여러 장을 한 장에 합친 콜라주
- 작은 글자를 빽빽하게 채운 구성
${isThumbnail ? "" : "- 썸네일처럼 큰 제목이 전면을 차지하는 구성\n- 주제 전체를 반복하는 대형 헤드라인·질문형 카피"}

중요: 다른 채팅에 이 요청서만 단독으로 붙여넣어도 바로 제작할 수 있게 필요한 정보를 모두 포함했다.`;
}

function isPreviousStrictBodyPrompt(prompt: string, topic: Topic, slotId: SlotId) {
  if (slotId === "00") return false;
  const info = SLOT_INFO[slotId];
  return prompt.includes(`슬롯: ${slotId} · ${info.label}`) &&
    prompt.includes(`글 주제: ${topic.title}`) &&
    prompt.includes("- 큰 제목, 질문형 카피, 제목 박스, 리본, 배지, 카드형 설명 문구를 넣지 말 것") &&
    prompt.includes("- 원형 배지·화살표·강조 카피를 여러 개 배치한 광고형 인포그래픽") &&
    prompt.includes("- 과학적 이해에 꼭 필요한 경우에만 짧은 라벨 1~3개 정도 허용");
}

function refreshLegacyImagePrompts(works: Record<number, TopicWork>) {
  let changed = false;
  const next = { ...works };

  for (const topic of TOPICS) {
    const current = works[topic.id];
    if (!current?.slots) continue;

    let topicChanged = false;
    const slots = { ...current.slots };

    for (const slotId of ["01", "02", "03"] as SlotId[]) {
      const slot = slots[slotId];
      if (!slot) continue;
      if (slot.prompt === buildLegacyImagePrompt(topic, slotId) || isPreviousStrictBodyPrompt(slot.prompt, topic, slotId)) {
        slots[slotId] = { ...slot, prompt: buildImagePrompt(topic, slotId) };
        topicChanged = true;
        changed = true;
      }
    }

    if (topicChanged) next[topic.id] = { ...current, slots };
  }

  return changed ? next : works;
}

function normalizeParammaTopic(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\d{4}년|\d{1,2}월|\d{1,2}일/g, "")
    .replace(/[\s·｜|?？!！,.'\"“”‘’()\[\]{}:;~_-]/g, "");
}

function defaultWork(topic: Topic): TopicWork {
  return {
    articlePrompt: buildArticlePrompt(topic),
    body: "",
    bodyConfirmed: false,
    optional03: false,
    slots: {
      "00": { status: "waiting", prompt: buildImagePrompt(topic, "00") },
      "01": { status: "waiting", prompt: buildImagePrompt(topic, "01") },
      "02": { status: "waiting", prompt: buildImagePrompt(topic, "02") },
      "03": { status: "waiting", prompt: buildImagePrompt(topic, "03") },
    },
  };
}

function cleanFolderName(topic: Topic) {
  const short = topic.title.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "_").slice(0, 40);
  return `${String(topic.id).padStart(2, "0")}_${short || "paramma"}`;
}

function imageKey(topicId: number, slotId: SlotId) {
  return `topic-${topicId}/slot-${slotId}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(DB_STORE)) req.result.createObjectStore(DB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("이미지 저장소를 열 수 없습니다."));
  });
}

async function idbGet(topicId: number, slotId: SlotId): Promise<ImageRecord | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const req = tx.objectStore(DB_STORE).get(imageKey(topicId, slotId));
    req.onsuccess = () => resolve((req.result as ImageRecord | undefined) || null);
    req.onerror = () => reject(req.error || new Error("이미지를 불러오지 못했습니다."));
    tx.oncomplete = () => db.close();
  });
}

async function idbPut(topicId: number, slotId: SlotId, record: ImageRecord) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(record, imageKey(topicId, slotId));
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error("이미지를 저장하지 못했습니다.")); };
  });
}

async function idbDelete(topicId: number, slotId: SlotId) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).delete(imageKey(topicId, slotId));
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error("이미지를 삭제하지 못했습니다.")); };
  });
}

function loadHtmlImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("이미지 파일을 읽을 수 없습니다."));
    img.src = src;
  });
}

async function convertToPng(file: File, targetWidth: number, targetHeight: number) {
  if (!file.type.startsWith("image/")) throw new Error("이미지 파일만 등록할 수 있습니다.");
  const sourceUrl = URL.createObjectURL(file);
  try {
    const img = await loadHtmlImage(sourceUrl);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("PNG 변환 기능을 사용할 수 없습니다.");
    ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((out) => out ? resolve(out) : reject(new Error("PNG 변환에 실패했습니다.")), "image/png");
    });
    const actualRatio = img.naturalWidth / img.naturalHeight;
    const targetRatio = targetWidth / targetHeight;
    const gap = Math.abs(actualRatio - targetRatio) / targetRatio;
    const warning = gap > 0.04
      ? `목표 비율과 다릅니다. 원본 ${img.naturalWidth}×${img.naturalHeight}px 그대로 보존하며 자르거나 늘리지 않았습니다.`
      : "";
    return { blob, width: img.naturalWidth, height: img.naturalHeight, warning };
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

async function hasPngSignature(blob: Blob) {
  const bytes = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
  const png = [137, 80, 78, 71, 13, 10, 26, 10];
  return png.every((value, index) => bytes[index] === value);
}

function buildNextTenPrompt() {
  const previous = TOPICS.map((t) => `${t.id}. [${t.category}] ${t.title}`).join("\n");
  return `Paramma 블로거의 다음 발행 순서 10개를 새로 추천해줘.

현재 날짜 기준으로 계절성·검색성·생활 궁금증·블로그 색깔을 함께 고려해줘.

[운영 카테고리]
- 신기한 동물이야기
- 신비로운 자연
- 생활 속 궁금증
- 신기한 우리 몸

[운영 방식]
- 탭별로 따로 추천하지 말고 네 카테고리를 한 개의 발행 큐에 섞을 것.
- 신기한 우리 몸은 2~3개 정도 포함해 새 카테고리 반응을 계속 확인할 것.
- 1번부터 10번까지 실제로 올릴 순서를 정해줄 것.
- 검색형·생활형 소재를 중심으로 하되 희귀하고 신기한 소재도 일부 섞을 것.
- 대략 검색형 70%, 희귀·신기형 30% 느낌으로 구성.
- 같은 종류의 소재가 연속해서 몰리지 않게 할 것.
- 계절에 맞지 않는 주제는 우선순위를 낮출 것.
- 아래 이전 10개와 동일하거나 지나치게 비슷한 주제는 제외할 것.
- 각 항목에 카테고리와 한 줄 기획 의도를 함께 표시할 것.
- “평소 자주 보지만 이유는 잘 모르는 것”처럼 제목을 보는 순간 “그러게, 왜 그렇지?”가 나오는 생활 호기심형을 최우선으로 할 것.
- 계절성만을 이유로 궁금증이 약한 소재를 억지로 넣지 말 것.
- 각 항목마다 실제 발행용 글 제목과 네이버 홈용 썸네일 후킹 문구를 따로 제안할 것.
- 썸네일 문구는 1초 안에 이해되는 짧은 질문형·호기심형을 우선하고 답을 미리 알려주지 말 것.
- 썸네일 문구가 모두 같은 “왜 ~할까?” 문법으로 반복되지 않게 자연스럽게 섞을 것.

[이전 10개]
${previous}

최종 출력은 1~10번 표로 깔끔하게 정리해줘.
표 열은 순서 | 카테고리 | 발행용 글 제목 | 썸네일 후킹 문구 | 한 줄 기획 의도로 구성해줘.`;
}

export default function ParammaBulkPage() {
  const [topics, setTopics] = useState<Topic[]>(TOPICS);
  const [selectedId, setSelectedId] = useState(1);
  const [statuses, setStatuses] = useState<Record<number, Status>>({});
  const [works, setWorks] = useState<Record<number, TopicWork>>({});
  const [historyItems, setHistoryItems] = useState<ParammaHistoryItem[]>([]);
  const [historyFilter, setHistoryFilter] = useState<"전체" | Category>("전체");
  const [historySearch, setHistorySearch] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [images, setImages] = useState<Partial<Record<SlotId, LoadedImage>>>({});
  const [notice, setNotice] = useState("");
  const [naverCopyMessage, setNaverCopyMessage] = useState("");
  const [imageBusy, setImageBusy] = useState<SlotId | null>(null);
  const [zipBusy, setZipBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const previewUrls = useRef<string[]>([]);

  const selected = topics.find((t) => t.id === selectedId) || topics[0] || TOPICS[0];
  const work = works[selected.id] || defaultWork(selected);
  const articleChatUrl = "https://chatgpt.com/?q=" + encodeURIComponent(work.articlePrompt);
  const naverBlocks = useMemo(() => parseNaverBlog(work.body), [work.body]);
  const doneCount = useMemo(() => topics.filter((t) => statuses[t.id] === "done").length, [topics, statuses]);
  const progress = Math.round((doneCount / Math.max(1, topics.length)) * 100);
  const availablePoolCount = useMemo(() => {
    const historyKeys = new Set(historyItems.map((item) => item.normalized_key));
    const queueKeys = new Set(topics.map((topic) => normalizeParammaTopic(topic.title)));
    return TOPIC_POOL.filter((topic) => !historyKeys.has(normalizeParammaTopic(topic.title)) && !queueKeys.has(normalizeParammaTopic(topic.title))).length;
  }, [historyItems, topics]);
  const filteredHistory = useMemo(() => {
    const keyword = historySearch.trim().toLowerCase();
    return historyItems.filter((item) => {
      const categoryMatch = historyFilter === "전체" || item.category === historyFilter;
      const textMatch = !keyword || [item.title, item.category, item.published_on].join(" ").toLowerCase().includes(keyword);
      return categoryMatch && textMatch;
    });
  }, [historyItems, historyFilter, historySearch]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const savedTopics = Array.isArray(parsed?.topics) && parsed.topics.length === 10 ? parsed.topics as Topic[] : TOPICS;
        setTopics(savedTopics);
        if (parsed?.statuses) setStatuses(parsed.statuses);
        if (parsed?.selectedId && savedTopics.some((t) => t.id === parsed.selectedId)) setSelectedId(parsed.selectedId);
        if (parsed?.works) setWorks(refreshLegacyImagePrompts(parsed.works));
      }
    } catch {
      setNotice("이전 작업 정보 일부를 불러오지 못했습니다.");
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    void loadPublishHistory();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const completed = topics.filter((topic) => statuses[topic.id] === "done");
    if (!completed.length) return;
    void fetch("/api/paramma/publish-history", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: completed.map((topic) => ({
          title: topic.title,
          category: topic.category,
          thumbnailHook: topic.thumbnailHook,
          source: "paramma-local-migration",
        })),
      }),
    }).then(() => loadPublishHistory()).catch(() => {});
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ topics, statuses, selectedId, works }));
    } catch {
      setNotice("작업 상태 저장에 실패했습니다. 브라우저 저장공간을 확인해주세요.");
    }
  }, [hydrated, topics, statuses, selectedId, works]);

  useEffect(() => {
    let cancelled = false;
    async function restoreImages() {
      previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrls.current = [];
      const next: Partial<Record<SlotId, LoadedImage>> = {};
      for (const slotId of SLOT_IDS) {
        try {
          const record = await idbGet(selected.id, slotId);
          if (record) {
            const url = URL.createObjectURL(record.blob);
            previewUrls.current.push(url);
            next[slotId] = { ...record, url };
          }
        } catch {}
      }
      if (cancelled) {
        Object.values(next).forEach((item) => item && URL.revokeObjectURL(item.url));
        return;
      }
      setImages(next);
      setWorks((prev) => {
        const base = prev[selected.id] || defaultWork(selected);
        let changed = false;
        const slots = { ...base.slots };
        for (const slotId of SLOT_IDS) {
          const registered = !!next[slotId];
          if (registered && slots[slotId].status !== "registered") {
            slots[slotId] = { ...slots[slotId], status: "registered", width: next[slotId]?.width, height: next[slotId]?.height };
            changed = true;
          } else if (!registered && slots[slotId].status === "registered") {
            slots[slotId] = { ...slots[slotId], status: "waiting", width: undefined, height: undefined, warning: undefined };
            changed = true;
          }
        }
        return changed ? { ...prev, [selected.id]: { ...base, slots } } : prev;
      });
    }
    void restoreImages();
    return () => { cancelled = true; };
  }, [selected.id]);

  useEffect(() => () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  function ensureWork(topicId = selected.id) {
    const topic = topics.find((t) => t.id === topicId) || topics[0] || TOPICS[0];
    return works[topicId] || defaultWork(topic);
  }

  function patchWork(patch: Partial<TopicWork>, topicId = selected.id) {
    setWorks((prev) => {
      const topic = topics.find((t) => t.id === topicId) || topics[0] || TOPICS[0];
      const base = prev[topicId] || defaultWork(topic);
      return { ...prev, [topicId]: { ...base, ...patch } };
    });
  }

  function patchSlot(slotId: SlotId, patch: Partial<SlotMeta>, topicId = selected.id) {
    setWorks((prev) => {
      const topic = topics.find((t) => t.id === topicId) || topics[0] || TOPICS[0];
      const base = prev[topicId] || defaultWork(topic);
      return {
        ...prev,
        [topicId]: {
          ...base,
          slots: { ...base.slots, [slotId]: { ...base.slots[slotId], ...patch } },
        },
      };
    });
  }

  function statusOf(id: number): Status {
    return statuses[id] || "waiting";
  }

  function selectTopic(id: number) {
    setSelectedId(id);
    setNotice("");
  }

  function startTopic(id: number) {
    setSelectedId(id);
    setStatuses((prev) => ({ ...prev, [id]: prev[id] === "done" ? "done" : "working" }));
    if (!works[id]) {
      const topic = topics.find((t) => t.id === id) || topics[0] || TOPICS[0];
      setWorks((prev) => ({ ...prev, [id]: defaultWork(topic) }));
    }
  }

  async function loadPublishHistory() {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/paramma/publish-history", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "발행 이력 조회 실패");
      const items = Array.isArray(json.items)
        ? json.items.filter((item: unknown): item is ParammaHistoryItem =>
            Boolean(item && typeof item === "object" && typeof (item as ParammaHistoryItem).title === "string")
          )
        : [];
      setHistoryItems(items);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "발행 이력을 불러오지 못했습니다.");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function syncHistory(topic: Topic, published: boolean) {
    try {
      await fetch("/api/paramma/publish-history", {
        method: published ? "POST" : "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: topic.title,
          category: topic.category,
          thumbnailHook: topic.thumbnailHook,
          source: "paramma-bulk",
        }),
      });
    } catch {
      // 서버 동기화 실패 시에도 현재 브라우저의 발행 큐 작업은 계속됩니다.
    }
  }

  function completeTopic(id: number) {
    const topic = topics.find((item) => item.id === id);
    if (!topic) return;
    setStatuses((prev) => ({ ...prev, [id]: "done" }));
    setHistoryItems((prev) => {
      const key = normalizeParammaTopic(topic.title);
      if (prev.some((item) => item.normalized_key === key)) return prev;
      return [{
        normalized_key: key,
        title: topic.title,
        category: topic.category,
        thumbnail_hook: topic.thumbnailHook,
        published_on: new Intl.DateTimeFormat("sv-SE", {
          timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
        }).format(new Date()),
      }, ...prev];
    });
    void syncHistory(topic, true);
    const next = topics.find((t) => t.id > id && statusOf(t.id) !== "done");
    if (next) setSelectedId(next.id);
    setNotice(next ? `${id}번 발행 완료. 완료한 카드는 원할 때 갈아끼우면 됩니다.` : "10칸이 모두 완료됐습니다. 완료 카드의 ‘갈아끼우기’로 새 주제를 채워주세요.");
  }

  function undoComplete(id: number) {
    const topic = topics.find((item) => item.id === id);
    if (!topic) return;
    setStatuses((prev) => ({ ...prev, [id]: "working" }));
    setHistoryItems((prev) => prev.filter((item) => item.normalized_key !== normalizeParammaTopic(topic.title)));
    void syncHistory(topic, false);
    setSelectedId(id);
    setNotice(`${id}번 완료 처리를 취소했습니다.`);
  }

  async function replaceCompletedTopic(id: number) {
    const current = topics.find((item) => item.id === id);
    if (!current || statusOf(id) !== "done") return;

    const historyKeys = new Set(historyItems.map((item) => item.normalized_key));
    const queueKeys = new Set(topics.filter((item) => item.id !== id).map((item) => normalizeParammaTopic(item.title)));
    const available = TOPIC_POOL.filter((candidate) => {
      const key = normalizeParammaTopic(candidate.title);
      return !historyKeys.has(key) && !queueKeys.has(key);
    });

    if (!available.length) {
      setNotice("새 주제 후보가 모두 소진됐습니다. 주제 풀 보충이 필요합니다.");
      return;
    }

    const position = topics.findIndex((item) => item.id === id);
    const prevCategory = position > 0 ? topics[position - 1]?.category : null;
    const nextCategory = position >= 0 && position < topics.length - 1 ? topics[position + 1]?.category : null;
    const categoryCounts = topics
      .filter((item) => item.id !== id)
      .reduce<Record<string, number>>((acc, item) => {
        acc[item.category] = (acc[item.category] || 0) + 1;
        return acc;
      }, {});

    const ranked = [...available].sort((a, b) => {
      const aAdjacent = Number(a.category === prevCategory) + Number(a.category === nextCategory);
      const bAdjacent = Number(b.category === prevCategory) + Number(b.category === nextCategory);
      return aAdjacent - bAdjacent || (categoryCounts[a.category] || 0) - (categoryCounts[b.category] || 0);
    });
    const seed = (historyItems.length + id + topics.reduce((sum, topic) => sum + topic.title.length, 0)) % ranked.length;
    const picked = ranked[seed];
    const replacement: Topic = { id, ...picked };

    for (const slotId of SLOT_IDS) {
      try { await idbDelete(id, slotId); } catch {}
    }
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.current = [];
    setImages({});
    setTopics((prev) => prev.map((topic) => topic.id === id ? replacement : topic));
    setStatuses((prev) => ({ ...prev, [id]: "waiting" }));
    setWorks((prev) => ({ ...prev, [id]: defaultWork(replacement) }));
    setSelectedId(id);
    setNotice(`${id}번을 새 주제로 갈아끼웠습니다: ${replacement.title}`);
  }

  async function copyText(text: string, success: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(success);
      return true;
    } catch {
      setNotice("클립보드 복사에 실패했습니다. 요청서 내용을 직접 선택해 복사해주세요.");
      return false;
    }
  }

  async function copyArticlePrompt() {
    startTopic(selected.id);
    const current = ensureWork();
    await copyText(current.articlePrompt, `${selected.id}번 본문·이미지 기획 요청서를 복사했습니다.`);
  }

  async function copyImagePrompt(slotId: SlotId) {
    const current = ensureWork();
    const meta = current.slots[slotId];
    const copied = await copyText(
      meta.prompt,
      `${slotId} ${SLOT_INFO[slotId].label} 요청서를 복사했습니다. ChatGPT 새 채팅에서 Ctrl+V로 붙여넣으세요.`
    );
    if (!copied) return;
    startTopic(selected.id);
    if (meta.status !== "registered") patchSlot(slotId, { status: "working" });
  }

  async function copyNaverRichText() {
    if (!naverBlocks.length) {
      setNaverCopyMessage("완성 본문을 먼저 입력해 주세요.");
      return;
    }

    const plain = naverPlainText(naverBlocks);
    const html = naverRichHtml(naverBlocks);

    try {
      if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([plain], { type: "text/plain" }),
          }),
        ]);
        setNaverCopyMessage("✅ 네이버 서식 포함 전체복사 완료 · 네이버에서 Ctrl+V 하세요.");
      } else {
        await navigator.clipboard.writeText(plain);
        setNaverCopyMessage("ℹ️ 브라우저 제한으로 한줄띄기 텍스트로 복사했습니다.");
      }
    } catch {
      try {
        await navigator.clipboard.writeText(plain);
        setNaverCopyMessage("ℹ️ 서식 복사가 제한되어 한줄띄기 텍스트로 복사했습니다.");
      } catch {
        setNaverCopyMessage("복사에 실패했습니다. 브라우저 클립보드 권한을 확인해 주세요.");
      }
    }
  }

  async function copyNaverSafeText() {
    if (!naverBlocks.length) {
      setNaverCopyMessage("완성 본문을 먼저 입력해 주세요.");
      return;
    }
    try {
      await navigator.clipboard.writeText(naverPlainText(naverBlocks));
      setNaverCopyMessage("✅ 한줄띄기 안전복사 완료 · 폰트는 네이버 기본 설정을 사용합니다.");
    } catch {
      setNaverCopyMessage("복사에 실패했습니다. 브라우저 클립보드 권한을 확인해 주세요.");
    }
  }

  async function handleUpload(slotId: SlotId, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const info = SLOT_INFO[slotId];
    const oldImage = images[slotId];
    setImageBusy(slotId);
    setNotice("");
    try {
      const converted = await convertToPng(file, info.width, info.height);
      const record: ImageRecord = { blob: converted.blob, width: converted.width, height: converted.height, updatedAt: new Date().toISOString() };
      await idbPut(selected.id, slotId, record);
      const url = URL.createObjectURL(record.blob);
      previewUrls.current.push(url);
      setImages((prev) => {
        if (prev[slotId]?.url) URL.revokeObjectURL(prev[slotId]!.url);
        return { ...prev, [slotId]: { ...record, url } };
      });
      patchSlot(slotId, { status: "registered", width: record.width, height: record.height, warning: converted.warning, updatedAt: record.updatedAt });
      setNotice(`${slotId} 이미지를 실제 PNG로 변환해 등록했습니다.${converted.warning ? " 비율 경고를 확인해주세요." : ""}`);
    } catch (error: any) {
      setNotice(oldImage
        ? `이미지 교체에 실패했습니다. 기존 ${slotId} 이미지는 그대로 보존했습니다. ${error?.message || ""}`
        : `이미지 등록에 실패했습니다. ${error?.message || ""}`);
    } finally {
      setImageBusy(null);
    }
  }

  async function deleteImage(slotId: SlotId) {
    if (!images[slotId]) return;
    if (!window.confirm(`${slotId} 등록 이미지를 실제로 삭제할까요?`)) return;
    try {
      await idbDelete(selected.id, slotId);
      const oldUrl = images[slotId]?.url;
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      setImages((prev) => {
        const next = { ...prev };
        delete next[slotId];
        return next;
      });
      patchSlot(slotId, { status: "waiting", width: undefined, height: undefined, warning: undefined, updatedAt: undefined });
      setNotice(`${slotId} 이미지를 삭제했습니다.`);
    } catch (error: any) {
      setNotice(`이미지 삭제에 실패했습니다. ${error?.message || ""}`);
    }
  }

  function toggleOptional03() {
    const next = !work.optional03;
    patchWork({ optional03: next });
    setNotice(!next && images["03"]
      ? "선택 이미지 03을 사용 안 함으로 바꿨습니다. 등록된 이미지는 삭제하지 않고 보관하며 ZIP에서만 제외합니다."
      : next
        ? "선택 이미지 03을 활성화했습니다. ZIP 전에 이미지를 등록하거나 다시 선택 해제해야 합니다."
        : "선택 이미지 03을 사용하지 않습니다.");
  }

  const requiredSlots: SlotId[] = ["00", "01", "02"];
  const missingRequired = requiredSlots.filter((slotId) => !images[slotId]);
  const optionalMissing = work.optional03 && !images["03"];
  const bodyReady = work.body.trim().length > 0 && work.bodyConfirmed;
  const canZip = bodyReady && missingRequired.length === 0 && !optionalMissing;

  async function downloadZip() {
    if (!canZip) {
      setNotice("최종 검수 조건을 먼저 충족해주세요.");
      return;
    }
    setZipBusy(true);
    setNotice("");
    try {
      const current = ensureWork();
      const zip = new JSZip();
      const folder = zip.folder(cleanFolderName(selected));
      if (!folder) throw new Error("ZIP 폴더를 만들 수 없습니다.");
      const includeSlots: SlotId[] = current.optional03 ? ["00", "01", "02", "03"] : ["00", "01", "02"];
      for (const slotId of includeSlots) {
        const record = await idbGet(selected.id, slotId);
        if (!record) throw new Error(`${slotId} 이미지가 없습니다.`);
        if (!(await hasPngSignature(record.blob))) throw new Error(`${slotId} 파일의 실제 형식이 PNG가 아닙니다.`);
        folder.file(SLOT_INFO[slotId].filename, record.blob);
      }
      folder.file("final_post.txt", current.body);
      folder.file("article_request.txt", current.articlePrompt);
      folder.file("image_prompts.txt", includeSlots.map((slotId) => `[${slotId} ${SLOT_INFO[slotId].label}]\n${current.slots[slotId].prompt}`).join("\n\n====================\n\n"));
      folder.file("project.json", JSON.stringify({ topic: selected, bodyConfirmed: current.bodyConfirmed, optional03: current.optional03, slots: current.slots, exportedAt: new Date().toISOString() }, null, 2));
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${cleanFolderName(selected)}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("최종 검수 통과. 글별 폴더 구조의 ZIP을 만들었습니다.");
    } catch (error: any) {
      setNotice(`ZIP 생성에 실패했습니다. ${error?.message || ""}`);
    } finally {
      setZipBusy(false);
    }
  }

  async function requestNextTen() {
    const prompt = buildNextTenPrompt();

    // Open immediately while the click still has user activation, so popup blockers
    // do not swallow the ChatGPT window. Prefill the request just like other prompts.
    window.open(
      "https://chatgpt.com/?q=" + encodeURIComponent(prompt),
      "_blank",
      "noopener,noreferrer"
    );

    await copyText(
      prompt,
      "다음 10개 추천 요청서를 열고 클립보드에도 복사했습니다."
    );
  }

  function resetProgress() {
    if (!window.confirm("이번 10개의 진행 상태와 본문·요청서 설정을 초기화할까요? 등록 이미지는 별도 삭제하지 않습니다.")) return;
    setTopics(TOPICS);
    setStatuses({});
    setWorks({});
    setSelectedId(1);
    setNotice("진행 상태와 글 설정을 초기화했습니다. 등록 이미지 파일은 보존했습니다.");
  }

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <a href="/" className={styles.homeLink}>← 콘텐츠 메이커</a>
        <div className={styles.brand}>🌿 Paramma 블로거</div>
        <span className={styles.topbarSpacer} aria-hidden="true" />
      </header>

      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>PARAMMA PUBLISH QUEUE</p>
          <h1>상시 발행 큐 10개</h1>
          <p>날짜가 바뀌어도 10칸은 유지됩니다. 글을 발행 완료한 뒤 그 카드만 새 주제로 갈아끼우며 계속 운영합니다.</p>
        </div>
        <div className={styles.progressCard}>
          <div><b>{doneCount}</b><span>/ 10 완료</span></div>
          <div className={styles.progressTrack}><i style={{ width: `${progress}%` }} /></div>
          <small>{progress}% 진행</small>
        </div>
      </section>

      {notice && <div className={styles.notice}>{notice}</div>}

      <section className={styles.layout}>
        <div className={styles.queuePanel}>
          <div className={styles.sectionHead}>
            <div>
              <p className={styles.eyebrow}>PUBLISH QUEUE</p>
              <h2>완료한 자리만 갈아끼우기</h2>
            </div>
            <span>새 주제 후보 {availablePoolCount}개</span>
          </div>

          <div className={styles.queue}>
            {topics.map((topic) => {
              const status = statusOf(topic.id);
              const selectedNow = selected.id === topic.id;
              return (
                <article
                  key={topic.id}
                  className={`${styles.topicCard} ${selectedNow ? styles.selected : ""} ${status === "done" ? styles.done : ""}`}
                >
                  <button type="button" className={styles.topicSelect} onClick={() => selectTopic(topic.id)}>
                    <span className={styles.number}>{status === "done" ? "✓" : String(topic.id).padStart(2, "0")}</span>
                    <div className={styles.topicMain}>
                      <span className={`${styles.category} ${categoryClass(topic.category)}`}>
                        {categoryEmoji(topic.category)} {topic.category}
                      </span>
                      <b>{topic.title}</b>
                      <small>{topic.brief}</small>
                    </div>
                  </button>
                  <div className={styles.topicCardSide}>
                    <span className={`${styles.status} ${styles[status]}`}>
                      {status === "done" ? "발행 완료" : status === "working" ? "진행 중" : "대기"}
                    </span>
                    {status === "done" && (
                      <div className={styles.topicDoneActions}>
                        <button type="button" onClick={() => void replaceCompletedTopic(topic.id)}>갈아끼우기</button>
                        <button type="button" onClick={() => undoComplete(topic.id)}>완료 취소</button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          <div className={styles.nextBatch}>
            <div>
              <b>한꺼번에 다음 10개를 바꾸지 않습니다.</b>
              <span>발행 완료 → 갈아끼우기 순서로 한 자리씩 교체합니다. 후보가 5개 이하로 줄면 주제 풀 보충을 요청하면 됩니다.</span>
            </div>
            <strong>남은 후보 {availablePoolCount}개</strong>
          </div>

          <details className={styles.historyPanel}>
            <summary>
              <span>발행 이력</span>
              <small>{historyItems.length}개 저장됨</small>
            </summary>
            <div className={styles.historyBody}>
              <div className={styles.historyToolbar}>
                <input value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} placeholder="발행 주제 검색" />
                <button type="button" onClick={() => void loadPublishHistory()} disabled={historyLoading}>
                  {historyLoading ? "불러오는 중…" : "새로고침"}
                </button>
              </div>
              <div className={styles.historyFilters}>
                {(["전체", "신기한 동물이야기", "신비로운 자연", "생활 속 궁금증", "신기한 우리 몸"] as const).map((category) => (
                  <button
                    key={category}
                    type="button"
                    className={historyFilter === category ? styles.historyFilterActive : ""}
                    onClick={() => setHistoryFilter(category)}
                  >
                    {category === "전체" ? "전체" : category === "신기한 동물이야기" ? "동물" : category === "신비로운 자연" ? "자연" : category === "생활 속 궁금증" ? "생활" : "우리 몸"}
                    <span>{category === "전체" ? historyItems.length : historyItems.filter((item) => item.category === category).length}</span>
                  </button>
                ))}
              </div>
              <div className={styles.historyList}>
                {filteredHistory.slice(0, 120).map((item) => (
                  <div className={styles.historyRow} key={item.normalized_key}>
                    <span className={`${styles.category} ${categoryClass(item.category)}`}>{categoryEmoji(item.category)} {item.category}</span>
                    <b>{item.title}</b>
                    <time>{item.published_on}</time>
                  </div>
                ))}
              </div>
              {!filteredHistory.length && !historyLoading && <p className={styles.historyEmpty}>조건에 맞는 발행 이력이 없습니다.</p>}
            </div>
          </details>
        </div>

        <div className={styles.workColumn}>
          <section className={styles.workPanel}>
            <p className={styles.eyebrow}>01 · BODY & PLAN</p>
            <div className={styles.currentNo}>{String(selected.id).padStart(2, "0")}</div>
            <span className={`${styles.category} ${categoryClass(selected.category)}`}>
              {categoryEmoji(selected.category)} {selected.category}
            </span>
            <h2>{selected.title}</h2>
            <p className={styles.brief}>{selected.brief}</p>

            <div className={styles.primaryActions}>
              <a
                className={styles.primary}
                href={articleChatUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  startTopic(selected.id);
                  void copyText(work.articlePrompt, `${selected.id}번 본문·이미지 기획 요청서를 복사했습니다.`);
                }}
              >
                📝 본문·이미지 기획 요청서 복사 + 열기
              </a>
              <button type="button" className={styles.secondary} onClick={() => void copyArticlePrompt()}>
                요청서만 복사
              </button>
            </div>

            <details className={styles.promptDetails}>
              <summary>본문 요청서 확인·수정</summary>
              <textarea value={work.articlePrompt} onChange={(e) => patchWork({ articlePrompt: e.target.value })} />
            </details>

            <label className={styles.bodyLabel}>
              <span>ChatGPT 완성 본문 붙여넣기</span>
              <textarea
                className={styles.bodyEditor}
                value={work.body}
                onChange={(e) => patchWork({ body: e.target.value, bodyConfirmed: false })}
                placeholder="최종 제목 + 본문 + 태그를 붙여넣으세요."
              />
            </label>
            <button
              type="button"
              className={`${styles.confirmButton} ${work.bodyConfirmed ? styles.confirmed : ""}`}
              disabled={!work.body.trim()}
              onClick={() => patchWork({ bodyConfirmed: !work.bodyConfirmed })}
            >
              {work.bodyConfirmed ? "✓ 본문 검수 완료" : "본문 검수 완료로 표시"}
            </button>
          </section>

          <section className={styles.imageSection}>
            <div className={styles.sectionHead}>
              <div>
                <p className={styles.eyebrow}>02 · PARALLEL IMAGE WORK</p>
                <h2>이미지 요청서를 여러 창에 나눠 작업</h2>
              </div>
              <span>복사 → 작업 중 → 파일 등록</span>
            </div>

            <div className={styles.imageGrid}>
              {SLOT_IDS.map((slotId) => {
                const info = SLOT_INFO[slotId];
                const meta = work.slots[slotId];
                const image = images[slotId];
                const optionalInactive = slotId === "03" && !work.optional03;
                const chatUrl = "https://chatgpt.com/?q=" + encodeURIComponent(meta.prompt);
                return (
                  <article key={slotId} className={`${styles.imageCard} ${optionalInactive ? styles.inactiveCard : ""}`}>
                    <div className={styles.imageCardHead}>
                      <div>
                        <span className={styles.slotNo}>{slotId}</span>
                        <b>{info.label}</b>
                        <small>{info.width}×{info.height}px 제작 목표</small>
                      </div>
                      <span className={`${styles.slotStatus} ${styles[meta.status]}`}>
                        {meta.status === "registered" ? "등록 완료" : meta.status === "working" ? "작업 중" : "대기"}
                      </span>
                    </div>

                    {slotId === "03" && (
                      <button type="button" className={styles.optionalToggle} onClick={toggleOptional03}>
                        {work.optional03 ? "✓ 선택 이미지 03 사용 중 · 선택 해제" : "+ 선택 이미지 03 사용"}
                      </button>
                    )}

                    {optionalInactive && image && (
                      <div className={styles.retained}>등록 이미지 보관 중 · 현재 ZIP에서는 제외</div>
                    )}

                    <div className={styles.preview}>
                      {image ? (
                        <img src={image.url} alt={`${slotId} 미리보기`} />
                      ) : (
                        <div><b>이미지 미등록</b><span>다른 ChatGPT 창에서 만든 이미지를 여기에 등록</span></div>
                      )}
                    </div>

                    {image && <div className={styles.imageMeta}>{image.width}×{image.height}px · 실제 PNG 저장</div>}
                    {meta.warning && <div className={styles.ratioWarning}>⚠ {meta.warning}</div>}

                    <div className={styles.imageActions}>
                      <button type="button" onClick={() => void copyImagePrompt(slotId)} disabled={optionalInactive}>
                        요청서 복사
                      </button>
                      {optionalInactive ? (
                        <span className={styles.chatLinkDisabled} aria-disabled="true">ChatGPT 열기</span>
                      ) : (
                        <a
                          href={chatUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => {
                            startTopic(selected.id);
                            if (meta.status !== "registered") patchSlot(slotId, { status: "working" });
                          }}
                        >
                          ChatGPT 열기
                        </a>
                      )}
                    </div>

                    <details className={styles.slotPrompt}>
                      <summary>요청서 확인·수정</summary>
                      <textarea
                        value={meta.prompt}
                        onChange={(e) => patchSlot(slotId, { prompt: e.target.value })}
                        disabled={optionalInactive}
                      />
                    </details>

                    <div className={styles.uploadRow}>
                      <label className={`${styles.uploadButton} ${imageBusy === slotId ? styles.busy : ""}`}>
                        {imageBusy === slotId ? "PNG 변환 중…" : image ? "이미지 교체" : "이미지 등록"}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={(e) => void handleUpload(slotId, e)}
                          disabled={imageBusy !== null || optionalInactive}
                        />
                      </label>
                      <button
                        type="button"
                        className={styles.deleteButton}
                        onClick={() => void deleteImage(slotId)}
                        disabled={!image || imageBusy !== null}
                      >
                        삭제
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className={styles.naverEditor}>
            <div className={styles.naverEditorHead}>
              <div>
                <p className={styles.eyebrow}>03 · NAVER FINAL COPY</p>
                <h2>네이버 최종 편집 · 전체복사</h2>
                <span>현재 저장된 완성 본문에 제목 20pt · 소제목 18pt · 본문 15pt · 태그 13~14pt와 한 줄 띄기를 적용합니다.</span>
              </div>
            </div>

            <div className={styles.naverPreviewPane}>
              <div className={styles.naverPreviewHead}>
                <b>네이버 붙여넣기 미리보기</b>
                <span>{naverBlocks.length ? `${naverBlocks.length}개 블록 자동 인식` : "완성 본문을 입력하면 미리보기가 나타납니다."}</span>
              </div>
              <div className={styles.naverPreview}>
                {naverBlocks.length ? naverBlocks.map((block, index) => (
                  <div key={index}>
                    <div
                      className={
                        block.type === "title" ? styles.naverTitle :
                        block.type === "subheading" ? styles.naverSubheading :
                        block.type === "tags" ? styles.naverTags :
                        block.type === "image" ? styles.naverImageLine :
                        styles.naverBody
                      }
                    >
                      {block.text}
                    </div>
                    {index < naverBlocks.length - 1 && <div className={styles.naverSpacer} aria-hidden="true">&nbsp;</div>}
                  </div>
                )) : (
                  <div className={styles.naverPreviewEmpty}>제목 · 소제목 · 본문 · 태그의 실제 크기와 한 줄 띄기를 여기서 확인할 수 있습니다.</div>
                )}
              </div>
            </div>

            <div className={styles.naverCopyActions}>
              <button type="button" className={styles.naverPrimaryCopy} onClick={() => void copyNaverRichText()}>
                네이버 서식 포함 전체복사
              </button>
              <button type="button" onClick={() => void copyNaverSafeText()}>
                한줄띄기 안전복사
              </button>
              <span>기본은 서식 포함 전체복사 → 네이버 Ctrl+V</span>
            </div>

            {naverCopyMessage && <div className={styles.naverCopyNotice}>{naverCopyMessage}</div>}
          </section>

          <section className={styles.reviewPanel}>
            <div className={styles.sectionHead}>
              <div><p className={styles.eyebrow}>04 · FINAL REVIEW & ZIP</p><h2>최종 검수</h2></div>
              <span>{canZip ? "ZIP 준비 완료" : "필수 항목 확인 필요"}</span>
            </div>

            <div className={styles.checkList}>
              <div className={bodyReady ? styles.pass : styles.fail}>
                <span>{bodyReady ? "✓" : "!"}</span>
                <p><b>본문</b><small>{work.body.trim() ? (work.bodyConfirmed ? "본문 입력·검수 완료" : "본문은 입력됐지만 검수 완료 표시가 필요합니다.") : "본문을 붙여넣어야 합니다."}</small></p>
              </div>
              {requiredSlots.map((slotId) => (
                <div key={slotId} className={images[slotId] ? styles.pass : styles.fail}>
                  <span>{images[slotId] ? "✓" : "!"}</span>
                  <p><b>{slotId} {SLOT_INFO[slotId].label}</b><small>{images[slotId] ? `${images[slotId]!.width}×${images[slotId]!.height}px · 실제 PNG` : "필수 이미지가 없습니다."}</small></p>
                </div>
              ))}
              <div className={!work.optional03 || images["03"] ? styles.pass : styles.fail}>
                <span>{!work.optional03 || images["03"] ? "✓" : "!"}</span>
                <p>
                  <b>03 선택 이미지</b>
                  <small>
                    {work.optional03
                      ? (images["03"] ? "사용함 · 이미지 등록 완료" : "사용 중이므로 이미지를 등록하거나 선택 해제해야 합니다.")
                      : images["03"] ? "사용 안 함 · 등록 이미지는 보관 중, ZIP 제외" : "사용 안 함"}
                  </small>
                </p>
              </div>
            </div>

            {missingRequired.length > 0 && <div className={styles.blocker}>필수 이미지 누락: {missingRequired.join(", ")}</div>}
            {optionalMissing && <div className={styles.blocker}>선택 이미지 03을 활성화했습니다. 이미지를 등록하거나 선택 해제해주세요.</div>}

            <div className={styles.zipInfo}>
              <b>ZIP 내부 글별 폴더</b>
              <code>{cleanFolderName(selected)}/</code>
              <span>00_thumbnail.png · 01_body.png · 02_body.png{work.optional03 ? " · 03_body.png" : ""} · final_post.txt · 요청서 파일</span>
            </div>

            <div className={styles.finalActions}>
              <button type="button" className={styles.zipButton} disabled={!canZip || zipBusy} onClick={() => void downloadZip()}>
                {zipBusy ? "PNG 확인·ZIP 생성 중…" : "최종 검수 통과 · ZIP 다운로드"}
              </button>
              <button type="button" className={styles.completeButton} onClick={() => completeTopic(selected.id)}>
                ✓ 이 글 발행 완료
              </button>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}