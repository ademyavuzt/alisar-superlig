import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import "./styles.css";
const uid = () => crypto.randomUUID();
const load = (key, fallback) => JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));


const emptyTeam = { name: "", logo: "", president: "", manual: false, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, pts: 0 };
const emptyPlayer = { name: "", teamId: "", position: "", number: "", foot: "", assists: 0 };
const emptyMatch = { homeId: "", awayId: "", date: "", field: "", homeScore: "", awayScore: "", scorers: [], yellows: [], reds: [], finished: false };

export default function App() {
  const [page, setPage] = useState("home");

useEffect(() => {
  fetchAll();
}, []);

async function fetchAll() {
  const { data: teamsData } = await supabase.from("teams").select("*").order("created_at");
  const { data: playersData } = await supabase.from("players").select("*").order("created_at");
  const { data: matchesData } = await supabase.from("matches").select("*").order("created_at");

  setTeams(teamsData || []);
  setPlayers(playersData || []);
  setMatches(matchesData || []);
}

 const [teams, setTeams] = useState([]);
 const [players, setPlayers] = useState([]);
 const [matches, setMatches] = useState([]);

  const [finishId, setFinishId] = useState("");
  const [finishScore, setFinishScore] = useState({ homeScore: "", awayScore: "" });
  const [finishScorers, setFinishScorers] = useState([]);
  const [finishYellows, setFinishYellows] = useState([]);
  const [finishReds, setFinishReds] = useState([]);



  const getTeam = (id) => teams.find(t => t.id === id);
  const getTeamName = (id) => getTeam(id)?.name || "-";
  const getPlayerName = (id) => players.find(p => p.id === id)?.name || "-";

  const standings = useMemo(() => {
    const map = new Map();

    teams.forEach(t => {
      map.set(t.id, {
        ...t,
        played: t.manual ? Number(t.played || 0) : 0,
        wins: t.manual ? Number(t.wins || 0) : 0,
        draws: t.manual ? Number(t.draws || 0) : 0,
        losses: t.manual ? Number(t.losses || 0) : 0,
        gf: t.manual ? Number(t.gf || 0) : 0,
        ga: t.manual ? Number(t.ga || 0) : 0,
        pts: t.manual ? Number(t.pts || 0) : 0,
      });
    });

    matches.forEach(m => {
      if (!m.finished) return;
      const hs = Number(m.homeScore);
      const as = Number(m.awayScore);
      const h = map.get(m.homeId);
      const a = map.get(m.awayId);
      if (!h || !a) return;

      if (!h.manual) { h.played++; h.gf += hs; h.ga += as; }
      if (!a.manual) { a.played++; a.gf += as; a.ga += hs; }

      if (hs > as) {
        if (!h.manual) { h.wins++; h.pts += 3; }
        if (!a.manual) a.losses++;
      } else if (hs < as) {
        if (!a.manual) { a.wins++; a.pts += 3; }
        if (!h.manual) h.losses++;
      } else {
        if (!h.manual) { h.draws++; h.pts++; }
        if (!a.manual) { a.draws++; a.pts++; }
      }
    });

    return [...map.values()].sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
  }, [teams, matches]);

  const playerStats = useMemo(() => {
    const map = new Map(players.map(p => [p.id, { ...p, goals: 0, yellow: 0, red: 0 }]));

    matches.forEach(m => {
      if (!m.finished) return;
      (m.scorers || []).forEach(id => { if (map.get(id)) map.get(id).goals++; });
      (m.yellows || []).forEach(id => { if (map.get(id)) map.get(id).yellow++; });
      (m.reds || []).forEach(id => { if (map.get(id)) map.get(id).red++; });
    });

    return [...map.values()].sort((a, b) => b.goals - a.goals);
  }, [players, matches]);

  const upcoming = matches.filter(m => !m.finished);
  const past = matches.filter(m => m.finished);
  const dayMatch = upcoming[0];

  const matchPlayers = finishId
    ? players.filter(p => {
        const m = matches.find(x => x.id === finishId);
        return m && (p.teamId === m.homeId || p.teamId === m.awayId);
      })
    : [];

  function formatDate(value) {
    if (!value) return "-";
    const d = new Date(value);
    const n = new Date();
    const today = d.toDateString() === n.toDateString();
    const time = d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    return today ? `BUGÜN ${time}` : `${d.toLocaleDateString("tr-TR")} ${time}`;
  }

async function addTeam() {
  if (!teamForm.name.trim()) return alert("Takım adı boş olamaz.");

  await supabase.from("teams").insert({
    name: teamForm.name,
    logo: teamForm.logo,
    president: teamForm.president,
    manual: false,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    gf: 0,
    ga: 0,
    pts: 0
  });

  setTeamForm(emptyTeam);
  fetchAll();
}

  function fileToBase64(file, callback) {
  const reader = new FileReader();
  reader.onload = () => callback(reader.result);
  reader.readAsDataURL(file);
}

  function addPlayer() {
    if (!playerForm.name.trim()) return alert("Oyuncu adı boş olamaz.");
    if (!playerForm.teamId) return alert("Takım seç.");
    setPlayers([...players, { ...emptyPlayer, ...playerForm, id: uid() }]);
    setPlayerForm(emptyPlayer);
  }

  function deletePlayer(id) {
    if (!confirm("Oyuncu silinsin mi?")) return;
    setPlayers(players.filter(p => p.id !== id));
  }

  function addMatch() {
    if (!matchForm.homeId || !matchForm.awayId) return alert("Takım seç.");
    if (matchForm.homeId === matchForm.awayId) return alert("Aynı takım kendiyle maç yapamaz.");
    setMatches([...matches, { ...emptyMatch, ...matchForm, id: uid() }]);
    setMatchForm(emptyMatch);
  }

  function updateMatch(id, key, value) {
    setMatches(matches.map(m => m.id === id ? { ...m, [key]: value } : m));
  }

  function deleteMatch(id) {
    if (!confirm("Maç silinsin mi?")) return;
    setMatches(matches.filter(m => m.id !== id));
  }

  function finishMatch() {
    if (!finishId) return alert("Maç seç.");
    if (finishScore.homeScore === "" || finishScore.awayScore === "") return alert("Skor gir.");

    setMatches(matches.map(m => m.id === finishId ? {
      ...m,
      homeScore: finishScore.homeScore,
      awayScore: finishScore.awayScore,
      scorers: finishScorers.filter(Boolean),
      yellows: finishYellows.filter(Boolean),
      reds: finishReds.filter(Boolean),
      finished: true
    } : m));

    setFinishId("");
    setFinishScore({ homeScore: "", awayScore: "" });
    setFinishScorers([]);
    setFinishYellows([]);
    setFinishReds([]);
  }

  function setManualStat(id, key, value) {
    setTeams(teams.map(t => t.id === id ? { ...t, manual: true, [key]: Number(value) } : t));
  }

  function resetManual(id) {
    setTeams(teams.map(t => t.id === id ? { ...t, manual: false } : t));
  }

  return (
    <div className="app">
      <aside>
        <div className="brand">
          <b>ALİŞAR</b>
          <span>SÜPERLİG</span>
        </div>

        <nav>
          <button onClick={() => setPage("home")} className={page === "home" ? "active" : ""}>Ana Sayfa</button>
          <button onClick={() => setPage("teams")} className={page === "teams" ? "active" : ""}>Takımlar</button>
          <button onClick={() => setPage("players")} className={page === "players" ? "active" : ""}>Oyuncular</button>
          <button onClick={() => setPage("matches")} className={page === "matches" ? "active" : ""}>Maçlar</button>
          <button onClick={() => setPage("admin")} className={page === "admin" ? "active" : ""}>Admin</button>
        </nav>

        <div className="sideCard">
          <b>Lig Özeti</b>
          <p>{teams.length} Takım</p>
          <p>{players.length} Oyuncu</p>
          <p>{matches.length} Maç</p>
        </div>
      </aside>

      <main>
        {page === "home" && (
          <>
            <section className="hero">
              <div>
                <span className="badge">SON DAKİKA!</span>
                <h1>Alişar Süperlig Başlıyor!</h1>
                <p>Yakın zamanda oyucular sahaya iniyor.</p>
              </div>
              <MatchCard title="Günün Maçı" match={dayMatch} getTeam={getTeam} formatDate={formatDate} />
            </section>

            <section className="grid two">
              <Standings teams={standings} />
              <Panel title="Lig Haberleri">
                <div className="news"><b>TRANSFER</b><p>Takımlar kadrolarını güçlendirmek için piyasaya indi.</p></div>
                <div className="news"><b>MAÇ ÖNÜ</b><p>Hanyanı Fc Perşembe günü saat 22:00 da Değirmen City 1453 takımı ile hazırlık maçı oynuyor.</p></div>
                <div className="news"><b>PERFORMANS</b><p>Gol krallığı yarışı kızışıyor.</p></div>
              </Panel>
            </section>
          </>
        )}

        {page === "teams" && (
          <Page title="Takımlar">
            <div className="cards">
              {standings.map(t => (
                <div className="teamCard" key={t.id}>
                  <Logo team={t} />
                  <h2>{t.name}</h2>
                  <p>Başkan: {t.president || "-"}</p>
                  <div className="stats">
                    <Stat label="Puan" value={t.pts} green />
                    <Stat label="Atılan Gol" value={t.gf} />
                    <Stat label="Yenilen Gol" value={t.ga} />
                    <Stat label="Averaj" value={t.gf - t.ga} />
                  </div>
                </div>
              ))}
            </div>
          </Page>
        )}

        {page === "players" && (
          <Page title="Oyuncular">
            <div className="cards">
              {playerStats.map(p => (
                <div className="teamCard" key={p.id}>
                  <div className="playerAvatar">{p.name?.[0]}</div>
                  <h2>{p.name}</h2>
                  <p>{getTeamName(p.teamId)}</p>
                  <div className="tags">
                    <span>#{p.number || "-"}</span>
                    <span>{p.position || "Mevki yok"}</span>
                    <span>{p.foot || "Ayak yok"}</span>
                  </div>
                  <div className="stats">
                    <Stat label="Gol" value={p.goals} green />
                    <Stat label="Asist" value={p.assists || 0} />
                    <Stat label="Sarı Kart" value={p.yellow} />
                    <Stat label="Kırmızı Kart" value={p.red} />
                  </div>
                </div>
              ))}
            </div>
          </Page>
        )}

        {page === "matches" && (
          <Page title="Maçlar">
            <div className="grid two">
              <Panel title="Gelecek Maçlar">
                {upcoming.map(m => <MatchCard key={m.id} match={m} getTeam={getTeam} formatDate={formatDate} />)}
              </Panel>

              <Panel title="Geçmiş Maçlar">
                {past.map(m => (
                  <div className="pastMatch" key={m.id}>
                    <b>{getTeamName(m.homeId)} {m.homeScore} - {m.awayScore} {getTeamName(m.awayId)}</b>
                    <small>{formatDate(m.date)} / {m.field || "-"}</small>
                    <p>Goller: {(m.scorers || []).map(getPlayerName).join(", ") || "-"}</p>
                    <p>Sarı: {(m.yellows || []).map(getPlayerName).join(", ") || "-"}</p>
                    <p>Kırmızı: {(m.reds || []).map(getPlayerName).join(", ") || "-"}</p>
                  </div>
                ))}
              </Panel>
            </div>
          </Page>
        )}

        {page === "admin" && (
          <Page title="Admin Panel">
            <div className="grid two">
             <Panel title="Takım Ekle / Sil">
  <input placeholder="Takım adı" value={teamForm.name} onChange={e => setTeamForm({ ...teamForm, name: e.target.value })} />

  <input
    type="file"
    accept="image/*"
    onChange={e => {
      const file = e.target.files[0];
      if (!file) return;
      fileToBase64(file, logo => setTeamForm({ ...teamForm, logo }));
    }}
  />

  {teamForm.logo && (
    <div className="previewLogo">
      <img src={teamForm.logo} />
    </div>
  )}

  <input placeholder="Takım başkanı" value={teamForm.president} onChange={e => setTeamForm({ ...teamForm, president: e.target.value })} />
  <button onClick={addTeam}>Takım Ekle</button>

  {teams.map(t => (
    <div className="teamEditBox" key={t.id}>
      <div className="teamEditTop">
        <Logo team={t} />
        <b>{t.name}</b>
      </div>

      <input
        placeholder="Takım adı"
        value={t.name}
        onChange={e => setTeams(teams.map(x => x.id === t.id ? { ...x, name: e.target.value } : x))}
      />

      <input
        placeholder="Takım başkanı"
        value={t.president}
        onChange={e => setTeams(teams.map(x => x.id === t.id ? { ...x, president: e.target.value } : x))}
      />

      <input
        type="file"
        accept="image/*"
        onChange={e => {
          const file = e.target.files[0];
          if (!file) return;
          fileToBase64(file, logo => {
            setTeams(teams.map(x => x.id === t.id ? { ...x, logo } : x));
          });
        }}
      />

      <button className="danger" onClick={() => deleteTeam(t.id)}>Takımı Sil</button>
    </div>
  ))}
</Panel>

              <Panel title="Oyuncu Ekle / Sil">
                <input placeholder="Oyuncu adı" value={playerForm.name} onChange={e => setPlayerForm({ ...playerForm, name: e.target.value })} />
                <select value={playerForm.teamId} onChange={e => setPlayerForm({ ...playerForm, teamId: e.target.value })}>
                  <option value="">Takım seç</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <input placeholder="Mevki" value={playerForm.position} onChange={e => setPlayerForm({ ...playerForm, position: e.target.value })} />
                <input placeholder="Forma no" value={playerForm.number} onChange={e => setPlayerForm({ ...playerForm, number: e.target.value })} />
                <input placeholder="Güçlü ayak" value={playerForm.foot} onChange={e => setPlayerForm({ ...playerForm, foot: e.target.value })} />
                <input type="number" placeholder="Asist" value={playerForm.assists} onChange={e => setPlayerForm({ ...playerForm, assists: e.target.value })} />
                <button onClick={addPlayer}>Oyuncu Ekle</button>

                {players.map(p => (
                  <div className="adminRow" key={p.id}>
                    <span>{p.name}</span>
                    <button className="danger" onClick={() => deletePlayer(p.id)}>Sil</button>
                  </div>
                ))}
              </Panel>

              <Panel title="Maç Ekle / Düzenle / Sil">
                <select value={matchForm.homeId} onChange={e => setMatchForm({ ...matchForm, homeId: e.target.value })}>
                  <option value="">Ev sahibi</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <select value={matchForm.awayId} onChange={e => setMatchForm({ ...matchForm, awayId: e.target.value })}>
                  <option value="">Deplasman</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <input type="datetime-local" value={matchForm.date} onChange={e => setMatchForm({ ...matchForm, date: e.target.value })} />
                <input placeholder="Saha adı" value={matchForm.field} onChange={e => setMatchForm({ ...matchForm, field: e.target.value })} />
                <button onClick={addMatch}>Maç Ekle</button>

                {matches.map(m => (
                  <div className="editMatch" key={m.id}>
                    <select value={m.homeId} onChange={e => updateMatch(m.id, "homeId", e.target.value)}>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <select value={m.awayId} onChange={e => updateMatch(m.id, "awayId", e.target.value)}>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <input type="datetime-local" value={m.date} onChange={e => updateMatch(m.id, "date", e.target.value)} />
                    <input value={m.field} onChange={e => updateMatch(m.id, "field", e.target.value)} />
                    <button className="danger" onClick={() => deleteMatch(m.id)}>Sil</button>
                  </div>
                ))}
              </Panel>

              <Panel title="Gelecek Maçı Sonlandır">
                <select value={finishId} onChange={e => setFinishId(e.target.value)}>
                  <option value="">Maç seç</option>
                  {upcoming.map(m => (
                    <option key={m.id} value={m.id}>{getTeamName(m.homeId)} - {getTeamName(m.awayId)}</option>
                  ))}
                </select>

                <div className="scoreInputs">
                  <input placeholder="Ev skor" value={finishScore.homeScore} onChange={e => setFinishScore({ ...finishScore, homeScore: e.target.value })} />
                  <input placeholder="Dep skor" value={finishScore.awayScore} onChange={e => setFinishScore({ ...finishScore, awayScore: e.target.value })} />
                </div>

                <button onClick={() => setFinishScorers([...finishScorers, ""])}>Gol Atan Oyuncu Ekle</button>
                {finishScorers.map((v, i) => (
                  <select key={i} value={v} onChange={e => {
                    const arr = [...finishScorers]; arr[i] = e.target.value; setFinishScorers(arr);
                  }}>
                    <option value="">Oyuncu seç</option>
                    {matchPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                ))}

                <button onClick={() => setFinishYellows([...finishYellows, ""])}>Sarı Kart Ekle</button>
                {finishYellows.map((v, i) => (
                  <select key={i} value={v} onChange={e => {
                    const arr = [...finishYellows]; arr[i] = e.target.value; setFinishYellows(arr);
                  }}>
                    <option value="">Oyuncu seç</option>
                    {matchPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                ))}

                <button onClick={() => setFinishReds([...finishReds, ""])}>Kırmızı Kart Ekle</button>
                {finishReds.map((v, i) => (
                  <select key={i} value={v} onChange={e => {
                    const arr = [...finishReds]; arr[i] = e.target.value; setFinishReds(arr);
                  }}>
                    <option value="">Oyuncu seç</option>
                    {matchPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                ))}

                <button className="finish" onClick={finishMatch}>Maçı Sonlandır</button>
              </Panel>

              <Panel title="Manuel Puan Düzeltme">
                {standings.map(t => (
                  <div className="manualBox" key={t.id}>
                    <b>{t.name} {t.manual ? "(Manuel)" : "(Otomatik)"}</b>
                    {["played", "wins", "draws", "losses", "gf", "ga", "pts"].map(k => (
                      <input key={k} type="number" placeholder={k} value={t[k]} onChange={e => setManualStat(t.id, k, e.target.value)} />
                    ))}
                    <button onClick={() => resetManual(t.id)}>Otomatiğe Al</button>
                  </div>
                ))}
              </Panel>
            </div>
          </Page>
        )}
      </main>
    </div>
  );
}

function Logo({ team }) {
  return <div className="logoBox">{team?.logo ? <img src={team.logo} /> : <span>{team?.name?.[0] || "?"}</span>}</div>;
}

function MatchCard({ match, getTeam, formatDate, title }) {
  if (!match) return <div className="matchCard"><h3>{title || "Maç"}</h3><p>Henüz maç eklenmedi.</p></div>;

  const home = getTeam(match.homeId);
  const away = getTeam(match.awayId);

return (
  <div className="versus">
    <div className="club">
      <Logo team={home} />
      <b>{home?.name}</b>
    </div>

    <strong>VS</strong>

    <div className="club">
      <b>{away?.name}</b>
      <Logo team={away} />
    </div>
  </div>
);
}

function Standings({ teams }) {
  return (
    <div className="panel">
      <h2>Puan Durumu</h2>
      <table>
        <thead>
          <tr><th>#</th><th>Takım</th><th>O</th><th>G</th><th>B</th><th>M</th><th>AG</th><th>YG</th><th>AV</th><th>P</th></tr>
        </thead>
        <tbody>
          {teams.map((t, i) => (
            <tr key={t.id}>
              <td>{i + 1}</td><td>{t.name}</td><td>{t.played}</td><td>{t.wins}</td><td>{t.draws}</td><td>{t.losses}</td>
              <td>{t.gf}</td><td>{t.ga}</td><td>{t.gf - t.ga}</td><td><b>{t.pts}</b></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Page({ title, children }) {
  return <><div className="pageTitle"><span className="badge">ALİŞAR SÜPERLİG</span><h1>{title}</h1></div>{children}</>;
}

function Panel({ title, children }) {
  return <div className="panel"><h2>{title}</h2>{children}</div>;
}

function Stat({ label, value, green }) {
  return <div className={green ? "stat green" : "stat"}><span>{label}</span><b>{value}</b></div>;

  useEffect(() => {
  fetchAll();
}, []);

async function fetchAll() {
  const { data: teamsData } = await supabase.from("teams").select("*").order("created_at");
  const { data: playersData } = await supabase.from("players").select("*").order("created_at");
  const { data: matchesData } = await supabase.from("matches").select("*").order("created_at");

  setTeams(teamsData || []);
  setPlayers(playersData || []);
  setMatches(matchesData || []);
}
async function addTeam() {
  console.log("TEAM EKLEME ÇALIŞTI");

  const { data, error } = await supabase
    .from("teams")
    .insert([
      {
        name: teamForm.name,
        logo: teamForm.logo,
        president: teamForm.president,
        manual: false,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        gf: 0,
        ga: 0,
        pts: 0
      }
    ]);

  console.log(data);
  console.log(error);

  fetchAll();
}
}