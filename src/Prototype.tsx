import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KeyboardInput, KeyboardTextarea, MobileScroll, useKeyboard } from "./mobile";
import "./prototype-extra.css";
import "./prototype-music.css";
import "./prototype-fixes.css";

const moods = [
  { emoji: "☀", label: "轻盈", track: "Sunset Lover", artist: "Petit Biscuit", color: "#dff6ee", query: "Sunset Lover Petit Biscuit" },
  { emoji: "⌁", label: "专注", track: "Bloom", artist: "The Paper Kites", color: "#dce9ff", query: "Bloom The Paper Kites" },
  { emoji: "✦", label: "兴奋", track: "Good Days", artist: "SZA", color: "#fff0bf", query: "Good Days SZA" },
  { emoji: "☾", label: "安静", track: "Mystery of Love", artist: "Sufjan Stevens", color: "#ece5ff", query: "Mystery of Love Sufjan Stevens" },
  { emoji: "≈", label: "松弛", track: "Coffee", artist: "beabadoobee", color: "#e4f3ef", query: "Coffee beabadoobee" },
  { emoji: "◇", label: "期待", track: "Every Summertime", artist: "NIKI", color: "#fff0d7", query: "Every Summertime NIKI" },
  { emoji: "∿", label: "疲惫", track: "Moon Song", artist: "Phoebe Bridgers", color: "#e7ebf7", query: "Moon Song Phoebe Bridgers" },
  { emoji: "●", label: "低落", track: "Space Song", artist: "Beach House", color: "#dfe4f3", query: "Space Song Beach House" },
  { emoji: "↯", label: "烦躁", track: "Hard Times", artist: "Paramore", color: "#ffe0d8", query: "Hard Times Paramore" },
  { emoji: "♡", label: "心动", track: "Glue Song", artist: "beabadoobee", color: "#ffe3ec", query: "Glue Song beabadoobee" },
  { emoji: "?", label: "迷茫", track: "Vienna", artist: "Billy Joel", color: "#e5e7fa", query: "Vienna Billy Joel" },
  { emoji: "↑", label: "有力量", track: "Dog Days Are Over", artist: "Florence + The Machine", color: "#ddf3e2", query: "Dog Days Are Over Florence" },
];

const musicSearchTerms = [
  "bright dreamy indie pop", "focus ambient indie", "upbeat alternative pop", "quiet acoustic indie",
  "relaxed bedroom pop", "hopeful indie pop", "gentle sad indie", "melancholy dream pop",
  "energetic alternative rock", "romantic bedroom pop", "reflective singer songwriter", "empowering indie pop",
];

type RealTrack = { trackName: string; artistName: string; previewUrl?: string; artworkUrl100?: string; trackViewUrl?: string };

const reasonOpeners = [
  "旋律的留白很克制，能让注意力慢慢聚拢",
  "节拍稳定却不催促，适合把呼吸调回自己的速度",
  "声音里的层次逐渐展开，像给当下留出了一点空间",
  "音色温柔但不松散，刚好托住此刻的情绪",
  "律动有清晰的方向感，又不会盖过你的思绪",
  "旋律带着微微上扬的力量，适合陪你继续往前",
];

function recommendationReason(track: string, artist: string, moodLabel: string) {
  const signature = `${track}-${artist}-${moodLabel}`;
  const hash = [...signature].reduce((total, char) => total + (char.codePointAt(0) || 0), 0);
  const opener = reasonOpeners[hash % reasonOpeners.length];
  const endings: Record<string, string> = {
    "轻盈": "让轻快不是飘过去，而是落在今天真实的小事里。",
    "专注": "它会留在背景里陪伴，不和正在做的事情争夺注意力。",
    "兴奋": "它接得住这股能量，也让快乐有继续延伸的空间。",
    "安静": "它不急着填满沉默，只把安静衬得更有质感。",
    "松弛": "像肩膀终于放下来，允许这一刻什么都不赶。",
    "期待": "旋律保留了一点未完成感，和期待本身很相像。",
    "疲惫": "它不会要求你振作，只先稳稳接住已经很累的部分。",
    "低落": "它理解低处的重量，同时留下一点可以透气的缝隙。",
    "烦躁": "清楚的节奏能帮杂乱找到出口，把情绪慢慢放平。",
    "心动": "细小的起伏像心跳被听见，让这份悸动不必解释。",
    "迷茫": "它不急着给答案，而是陪你在不确定里多待一会儿。",
    "有力量": "推进感不会过分用力，却能让下一步变得更明确。",
  };
  return `《${track}》里，${opener}。${endings[moodLabel] || `很适合此刻的「${moodLabel}」。`}`;
}

export default function Prototype() {
  const keyboard = useKeyboard();
  const [signedIn, setSignedIn] = useState(() => new URLSearchParams(window.location.search).has("preview"));
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [mood, setMood] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const [trackOffset, setTrackOffset] = useState(0);
  const [realTrack, setRealTrack] = useState<RealTrack | null>(null);
  const [musicLoading, setMusicLoading] = useState(false);
  const [archiveMode, setArchiveMode] = useState<"calendar"|"timeline"|"trend">("calendar");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const realTrackRef = useRef<RealTrack | null>(null);
  const previousTracksRef = useRef<RealTrack[]>([]);
  const [canGoBack, setCanGoBack] = useState(false);
  const searchRequestRef = useRef(0);
  const searchMusicRef = useRef<(index?: number, offset?: number, autoplay?: boolean) => Promise<void>>(async () => {});
  const [tab, setTab] = useState<"today" | "week" | "me">("today");
  const active = moods[mood];
  const bars = useMemo(() => Array.from({ length: 22 }, (_, i) => 8 + ((i * 17 + mood * 9) % 31)), [mood]);
  const displayTrack = realTrack ? { track: realTrack.trackName, artist: realTrack.artistName } : active;
  const aiReason = recommendationReason(displayTrack.track, displayTrack.artist, moods[mood].label);
  const stopAudio = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    setPlaying(false);
  }, []);
  const searchMusic = useCallback(async (index = mood, offset = 0, autoplay = false) => {
    const requestId = ++searchRequestRef.current;
    stopAudio(); setMusicLoading(true);
    try {
      const term = offset ? musicSearchTerms[index] : moods[index].query;
      const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=25&country=cn`);
      if (!response.ok) throw new Error(`Music search failed: ${response.status}`);
      const data = await response.json();
      const playableResults = (data.results || []).filter((track: RealTrack) =>
        track.previewUrl && track.previewUrl !== realTrackRef.current?.previewUrl
      ) as RealTrack[];
      const result = playableResults[offset ? (offset - 1) % Math.max(1, playableResults.length) : 0];
      if (requestId === searchRequestRef.current) {
        const nextTrack = result || null;
        const currentTrack = realTrackRef.current;
        if (currentTrack && nextTrack && currentTrack.previewUrl !== nextTrack.previewUrl) {
          previousTracksRef.current.push(currentTrack);
        }
        realTrackRef.current = nextTrack;
        setRealTrack(nextTrack);
        setCanGoBack(previousTracksRef.current.length > 0);
        if (autoplay && nextTrack?.previewUrl) {
          const audio = new Audio(nextTrack.previewUrl);
          audioRef.current = audio;
          audio.onended = () => {
            setPlaying(false);
            setTrackOffset(current => {
              const next = current + 1;
              void searchMusicRef.current(index, next, true);
              return next;
            });
          };
          void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
        }
      }
    } catch {
      if (requestId === searchRequestRef.current) setRealTrack(null);
    } finally {
      if (requestId === searchRequestRef.current) setMusicLoading(false);
    }
  }, [mood, stopAudio]);
  searchMusicRef.current = searchMusic;

  useEffect(() => () => {
    searchRequestRef.current += 1;
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
  }, []);

  const togglePreview = () => {
    if (!realTrack?.previewUrl) { searchMusic(); return; }
    if (!audioRef.current || audioRef.current.src !== realTrack.previewUrl) {
      if (audioRef.current) { audioRef.current.onended = null; audioRef.current.pause(); }
      audioRef.current = new Audio(realTrack.previewUrl);
      audioRef.current.onended = () => {
        setPlaying(false);
        setTrackOffset(current => {
          const next = current + 1;
          void searchMusicRef.current(mood, next);
          return next;
        });
      };
    }
    if (playing) {
      stopAudio();
    } else {
      void audioRef.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  };

  const chooseMood = (index: number) => {
    stopAudio();
    searchRequestRef.current += 1;
    previousTracksRef.current = [];
    realTrackRef.current = null;
    setRealTrack(null);
    setCanGoBack(false);
    setMood(index);
    setTrackOffset(0);
    void searchMusic(index, 0, true);
  };

  const playPreviousTrack = () => {
    const previousTrack = previousTracksRef.current.pop();
    if (!previousTrack) return;
    stopAudio();
    searchRequestRef.current += 1;
    realTrackRef.current = previousTrack;
    setRealTrack(previousTrack);
    setTrackOffset(current => Math.max(0, current - 1));
    setCanGoBack(previousTracksRef.current.length > 0);
  };

  const changeTab = (nextTab: "today" | "week" | "me") => {
    if (nextTab !== "today") stopAudio();
    setTab(nextTab);
  };

  if (!signedIn) {
    return <MobileScroll className="app-screen"><main className="authScreen">
      <div className="authOrb"><span>♫</span></div>
      <p className="eyebrow">MOOD FM · PRIVATE FREQUENCY</p>
      <h1>把今天的情绪，<br/><i>调成一首歌。</i></h1>
      <p className="authLead">不必解释得很完整。留下一个心情，我们会为此刻推荐一段声音。</p>
      <div className="authForm">
        <label>你的邮箱</label>
        <KeyboardInput value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.currentTarget.blur(); keyboard.hide(); setSent(true); } }} placeholder="name@example.com" inputMode="email" />
        {sent && <><label>6 位验证码</label><KeyboardInput value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.currentTarget.blur(); keyboard.hide(); setSignedIn(true); } }} placeholder="· · · · · ·" inputMode="numeric" /></>}
        <button className="primary" onClick={() => { keyboard.hide(); sent ? setSignedIn(true) : setSent(true); }}>{sent ? "进入我的频率" : "发送验证码"}<span>↗</span></button>
      </div>
      <p className="privacy">只保存你愿意留下的部分 · 可随时导出或删除</p>
    </main></MobileScroll>;
  }

  return <div className="appShell" style={{"--mood-color": active.color} as React.CSSProperties}>
    <MobileScroll key={tab} className="app-screen"><main className="homeScreen">
      <header><div><p className="mini">THU · 27 AUG</p><b>你好，诗涵</b></div><button className="avatar">邱</button></header>
      {tab === "today" && <>
        <section className="heroVisual"><img src="/generated/mood-fm-ip-group-v2.jpg" alt="四种心情中的诗涵"/><div className="livePill"><i/> YOUR MOOD IS LIVE</div><div className="wave">{bars.map((h,i)=><span key={i} style={{height:h}}/>)}</div></section>
        <section className="moodPanel"><p className="eyebrow">01 · CHECK IN</p><h1>今天，哪一个你<br/>正在播放？</h1><div className="moodRail expanded">{moods.map((item,i)=><button key={item.label} className={i===mood?"active":""} onClick={()=>chooseMood(i)}><span>{item.emoji}</span>{item.label}</button>)}</div></section>
        <section className="player"><div className={`miniVinyl ${playing?"spinning":""}`}>{realTrack?.artworkUrl100?<img src={realTrack.artworkUrl100} alt="专辑封面"/>:<span/>}</div><div className="track"><small>{musicLoading?"正在寻找真实歌曲…":`为「${moods[mood].label}」推荐 · 30 秒试听`}</small><b>{displayTrack.track}</b><span>{displayTrack.artist}</span></div><button className="play" onClick={togglePreview}>{playing?"Ⅱ":"▶"}</button></section>
        <div className="previewNotice"><b>30s</b><span>公开试听结束后会自动换一首；完整版可前往音乐平台播放。</span></div>
        <div className="aiReason"><span>AI</span><p><b>为什么是这首？</b>{aiReason}</p></div>
        <div className="playerActions"><button disabled={!canGoBack} onClick={playPreviousTrack}>← 上一首</button><button onClick={()=>{const next=trackOffset+1;setTrackOffset(next);void searchMusic(mood,next,true)}}>换一首 ↻</button><button onClick={()=>realTrack?.trackViewUrl&&window.open(realTrack.trackViewUrl,"_blank")}>Apple Music ↗</button></div>
        {!checkInOpen && <button className="record" onClick={()=>setCheckInOpen(true)}>+ 留下一句此刻的旁白</button>}
        {checkInOpen && <section className="checkInCard"><p className="eyebrow">02 · ADD CONTEXT</p><h3>这一刻，还发生了什么？</h3><KeyboardTextarea value={note} onChange={e=>setNote(e.target.value)} placeholder="比如：下班路上突然吹来一点凉风……"/><div className="sceneChips"><button>通勤</button><button>独处</button><button>工作后</button><button>散步</button></div><button className="saveMoment" onClick={()=>{keyboard.hide();setSaved(true);setCheckInOpen(false)}}>{saved?"已保存到情绪档案 ✓":"保存这一刻"}</button></section>}
        {saved && !checkInOpen && <div className="savedToast"><span>✓</span><div><b>已经收进今天的情绪档案</b><small>轻盈 · {active.track}{note?` · ${note}`:""}</small></div><button onClick={()=>setTab("me")}>查看</button></div>}
      </>}
      {tab === "week" && <section className="weekView"><p className="eyebrow">YOUR WEEK IN SOUND</p><h1>这周的你，<br/><i>听起来像什么？</i></h1><div className="weekOrb"><span>7</span><small>MOOD MOMENTS</small></div><div className="dayRows">{["MON","TUE","WED","THU"].map((d,i)=><div key={d}><b>{d}</b><span style={{width:`${42+i*13}%`}}/><em>{moods[i].label}</em></div>)}</div></section>}
      {tab === "me" && <section className="archiveView"><p className="eyebrow">MY MOOD ARCHIVE</p><h1>你的情绪，<br/><i>一直都在这里。</i></h1><div className="archiveStats"><div><b>18</b><small>记录天数</small></div><div><b>42</b><small>陪伴歌曲</small></div><div><b>轻盈</b><small>本月主调</small></div></div><div className="archiveTabs"><button className={archiveMode==="calendar"?"active":""} onClick={()=>setArchiveMode("calendar")}>日历</button><button className={archiveMode==="timeline"?"active":""} onClick={()=>setArchiveMode("timeline")}>时间线</button><button className={archiveMode==="trend"?"active":""} onClick={()=>setArchiveMode("trend")}>趋势</button></div>{archiveMode==="calendar"&&<div className="calendar"><header><b>2026 · AUG</b><span>‹　›</span></header><div className="weekLabels">{["一","二","三","四","五","六","日"].map(x=><i key={x}>{x}</i>)}</div><div className="days">{Array.from({length:28},(_,i)=><button key={i} className={[2,5,8,12,16,20,23,26].includes(i)?`logged m${i%4}`:""}>{i+1}{[2,5,8,12,16,20,23,26].includes(i)&&<em/>}</button>)}</div></div>}{archiveMode==="timeline"&&<div className="fullTimeline">{["今天 · 轻盈","8 月 26 日 · 安静","8 月 23 日 · 心动","8 月 20 日 · 疲惫","8 月 17 日 · 专注"].map((x,i)=><article key={x}><span>{moods[[0,3,9,6,1][i]].emoji}</span><div><b>{x}</b><small>{[displayTrack.track,"Mystery of Love","Glue Song","Moon Song","Bloom"][i]} · 点击回听</small></div></article>)}</div>}{archiveMode==="trend"&&<div className="trendCard"><p className="eyebrow">AUGUST FREQUENCY</p><h3>这个月，你正在慢慢变轻。</h3><div className="trendBars">{[46,62,38,72,55,82,68].map((v,i)=><i key={i} style={{height:v}}><em>{["一","二","三","四","五","六","日"][i]}</em></i>)}</div><p>轻盈与松弛比上周增加 <b>24%</b>，疲惫多出现在周三晚间。</p></div>}<div className="timeline"><p className="eyebrow">RECENT MOMENTS</p><article><span className="moodDot lavender">☾</span><div><b>安静地把一天放下</b><small>8 月 26 日 · Mystery of Love</small></div><button>›</button></article></div><div className="exportNote"><b>声音日记导出</b><span>适合做月度回顾、个人留存，或主动分享给咨询师；日常查看无需导出。</span><button>生成本月回顾 · PDF ↗</button></div></section>}
      <div className="bottomSpace"/>
    </main></MobileScroll>
    <nav className="tabBar"><button className={tab==="today"?"active":""} onClick={()=>changeTab("today")}><span>◉</span>此刻</button><button className={tab==="week"?"active":""} onClick={()=>changeTab("week")}><span>⌁</span>本周</button><button className={tab==="me"?"active":""} onClick={()=>changeTab("me")}><span>○</span>我的</button></nav>
  </div>;
}
