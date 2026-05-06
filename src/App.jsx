import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import "./styles.css";

const emptyTeam = {
  name: "",
  logo: "",
  president: "",
  manual: false,
  played: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  gf: 0,
  ga: 0,
  pts: 0,
};

const emptyPlayer = {
  name: "",
  team_id: "",
  position: "",
  number: "",
  foot: "",
  assists: 0,
};

const emptyMatch = {
  home_id: "",
  away_id: "",
  match_date: "",
  field: "",
  home_score: null,
  away_score: null,
  finished: false,
  scorers: [],
  yellows: [],
  reds: [],
};

export default function App() {
  const [page, setPage] = useState("home");

  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);

  const [teamForm, setTeamForm] = useState(emptyTeam);
  const [playerForm, setPlayerForm] = useState(emptyPlayer);
  const [matchForm, setMatchForm] = useState(emptyMatch);

  const [finishId, setFinishId] = useState("");
  const [finishScore, setFinishScore] = useState({ home_score: "", away_score: "" });
  const [finishScorers, setFinishScorers] = useState([]);
  const [finishYellows, setFinishYellows] = useState([]);
  const [finishReds, setFinishReds] = useState([]);
  const [playerFilterTeam, setPlayerFilterTeam] = useState("");
const [selectedTeamDetail, setSelectedTeamDetail] = useState(null);

  useEffect(() => {
    fetchAll();

    const channel = supabase
      .channel("alisar-live-data")
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, fetchAll)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchAll() {
    const { data: teamsData, error: teamsError } = await supabase
      .from("teams")
      .select("*")
      .order("created_at", { ascending: true });

    const { data: playersData, error: playersError } = await supabase
      .from("players")
      .select("*")
      .order("created_at", { ascending: true });

    const { data: matchesData, error: matchesError } = await supabase
      .from("matches")
      .select("*")
      .order("created_at", { ascending: true });

    if (teamsError) console.error("teams error:", teamsError);
    if (playersError) console.error("players error:", playersError);
    if (matchesError) console.error("matches error:", matchesError);

    setTeams(teamsData || []);
    setPlayers(playersData || []);
    setMatches(matchesData || []);
  }

  const getTeam = (id) => teams.find((t) => t.id === id);
  const getTeamName = (id) => getTeam(id)?.name || "-";
  const getPlayerName = (id) => players.find((p) => p.id === id)?.name || "-";

  const standings = useMemo(() => {
    const map = new Map();

    teams.forEach((team) => {
      map.set(team.id, {
        ...team,
        played: team.manual ? Number(team.played || 0) : 0,
        wins: team.manual ? Number(team.wins || 0) : 0,
        draws: team.manual ? Number(team.draws || 0) : 0,
        losses: team.manual ? Number(team.losses || 0) : 0,
        gf: team.manual ? Number(team.gf || 0) : 0,
        ga: team.manual ? Number(team.ga || 0) : 0,
        pts: team.manual ? Number(team.pts || 0) : 0,
      });
    });

    matches.forEach((m) => {
      if (!m.finished) return;

      const home = map.get(m.home_id);
      const away = map.get(m.away_id);
      if (!home || !away) return;

      const hs = Number(m.home_score || 0);
      const as = Number(m.away_score || 0);

      if (!home.manual) {
        home.played += 1;
        home.gf += hs;
        home.ga += as;
      }

      if (!away.manual) {
        away.played += 1;
        away.gf += as;
        away.ga += hs;
      }

      if (hs > as) {
        if (!home.manual) {
          home.wins += 1;
          home.pts += 3;
        }
        if (!away.manual) away.losses += 1;
      } else if (hs < as) {
        if (!away.manual) {
          away.wins += 1;
          away.pts += 3;
        }
        if (!home.manual) home.losses += 1;
      } else {
        if (!home.manual) {
          home.draws += 1;
          home.pts += 1;
        }
        if (!away.manual) {
          away.draws += 1;
          away.pts += 1;
        }
      }
    });

    return [...map.values()].sort(
      (a, b) => b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf
    );
  }, [teams, matches]);

  const playerStats = useMemo(() => {
  const filteredPlayers = playerFilterTeam
  ? playerStats.filter((p) => p.team_id === playerFilterTeam)
  : playerStats;
    const map = new Map(players.map((p) => [p.id, { ...p, goals: 0, yellow: 0, red: 0 }]));

    matches.forEach((m) => {
      if (!m.finished) return;

      (m.scorers || []).forEach((id) => {
        const p = map.get(id);
        if (p) p.goals += 1;
      });

      (m.yellows || []).forEach((id) => {
        const p = map.get(id);
        if (p) p.yellow += 1;
      });

      (m.reds || []).forEach((id) => {
        const p = map.get(id);
        if (p) p.red += 1;
      });
    });

    return [...map.values()].sort((a, b) => b.goals - a.goals);
  }, [players, matches]);

  const upcoming = matches.filter((m) => !m.finished);
  const past = matches.filter((m) => m.finished);
const dayMatch = upcoming[0] || past[0];
  const matchPlayers = finishId
    ? players.filter((p) => {
        const m = matches.find((x) => x.id === finishId);
        return m && (p.team_id === m.home_id || p.team_id === m.away_id);
      })
    : [];

  function formatDate(value) {
    if (!value) return "-";

    const d = new Date(value);
    const n = new Date();
    const today = d.toDateString() === n.toDateString();

    const time = d.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    return today ? `BUGÜN ${time}` : `${d.toLocaleDateString("tr-TR")} ${time}`;
  }

  function fileToBase64(file, callback) {
    const reader = new FileReader();
    reader.onload = () => callback(reader.result);
    reader.readAsDataURL(file);
  }

  async function addTeam() {
    if (!teamForm.name.trim()) return alert("Takım adı boş olamaz.");

    const { error } = await supabase.from("teams").insert({
      name: teamForm.name,
      logo: teamForm.logo || "",
      president: teamForm.president || "",
      manual: false,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      gf: 0,
      ga: 0,
      pts: 0,
    });

    if (error) return alert("Takım eklenemedi: " + error.message);

    setTeamForm(emptyTeam);
    fetchAll();
  }

  async function updateTeam(id, patch) {
    const { error } = await supabase.from("teams").update(patch).eq("id", id);
    if (error) return alert("Takım güncellenemedi: " + error.message);
    fetchAll();
  }

  async function deleteTeam(id) {
    if (!confirm("Takım silinsin mi? Oyuncular ve maçlar da silinir.")) return;

    const { error } = await supabase.from("teams").delete().eq("id", id);
    if (error) return alert("Takım silinemedi: " + error.message);

    fetchAll();
  }

  async function addPlayer() {
    if (!playerForm.name.trim()) return alert("Oyuncu adı boş olamaz.");
    if (!playerForm.team_id) return alert("Takım seç.");

    const { error } = await supabase.from("players").insert({
      name: playerForm.name,
      team_id: playerForm.team_id,
      position: playerForm.position || "",
      number: playerForm.number || "",
      foot: playerForm.foot || "",
      assists: Number(playerForm.assists || 0),
    });

    if (error) return alert("Oyuncu eklenemedi: " + error.message);

    setPlayerForm(emptyPlayer);
    fetchAll();
  }

  async function deletePlayer(id) {
    if (!confirm("Oyuncu silinsin mi?")) return;

    const { error } = await supabase.from("players").delete().eq("id", id);
    if (error) return alert("Oyuncu silinemedi: " + error.message);

    fetchAll();
  }

  async function addMatch() {
    if (!matchForm.home_id || !matchForm.away_id) return alert("Takım seç.");
    if (matchForm.home_id === matchForm.away_id) return alert("Aynı takım kendiyle maç yapamaz.");

    const { error } = await supabase.from("matches").insert({
      home_id: matchForm.home_id,
      away_id: matchForm.away_id,
      match_date: matchForm.match_date,
      field: matchForm.field || "",
      home_score: null,
      away_score: null,
      finished: false,
      scorers: [],
      yellows: [],
      reds: [],
    });

    if (error) return alert("Maç eklenemedi: " + error.message);

    setMatchForm(emptyMatch);
    fetchAll();
  }

  async function updateMatch(id, patch) {
    const { error } = await supabase.from("matches").update(patch).eq("id", id);
    if (error) return alert("Maç güncellenemedi: " + error.message);
    fetchAll();
  }

  async function deleteMatch(id) {
    if (!confirm("Maç silinsin mi?")) return;

    const { error } = await supabase.from("matches").delete().eq("id", id);
    if (error) return alert("Maç silinemedi: " + error.message);

    fetchAll();
  }

  async function finishMatch() {
    if (!finishId) return alert("Maç seç.");
    if (finishScore.home_score === "" || finishScore.away_score === "") return alert("Skor gir.");

    const { error } = await supabase
      .from("matches")
      .update({
        home_score: Number(finishScore.home_score),
        away_score: Number(finishScore.away_score),
        scorers: finishScorers.filter(Boolean),
        yellows: finishYellows.filter(Boolean),
        reds: finishReds.filter(Boolean),
        finished: true,
      })
      .eq("id", finishId);

    if (error) return alert("Maç sonlandırılamadı: " + error.message);

    setFinishId("");
    setFinishScore({ home_score: "", away_score: "" });
    setFinishScorers([]);
    setFinishYellows([]);
    setFinishReds([]);
    fetchAll();
  }

  async function setManualStat(id, key, value) {
    const { error } = await supabase
      .from("teams")
      .update({ manual: true, [key]: Number(value) })
      .eq("id", id);

    if (error) return alert("Puan güncellenemedi: " + error.message);

    fetchAll();
  }

  async function resetManual(id) {
    const { error } = await supabase.from("teams").update({ manual: false }).eq("id", id);
    if (error) return alert("Otomatik moda alınamadı: " + error.message);
    fetchAll();
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
                <h1>Alişar Süperlig Başlıyor.</h1>
                <p>Yakın zamanda oyuncular sahaya iniyor.</p>
              </div>
              <MatchCard title="Günün Maçı" match={dayMatch} getTeam={getTeam} formatDate={formatDate} />
            </section>

            <section className="grid two">
           <Standings
  teams={standings}
  onTeamClick={setSelectedTeamDetail}
/>
              <Panel title="Lig Haberleri">
                <div className="news"><b>TRANSFER</b><p>Takımlar kadrolarını güçlendirmek için piyasaya indi.</p></div>
                <div className="news"><b>MAÇ ÖNÜ</b><p>Haftanın maçı için sahada tansiyon yüksek.</p></div>
                <div className="news"><b>PERFORMANS</b><p>Gol krallığı yarışı kızışıyor.</p></div>
              </Panel>
            </section>
          </>
        )}

        {page === "teams" && (
          <Page title="Takımlar">
            <div className="cards">
              {standings.map((t) => (
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
         <div className="filterBar">
  <select
    value={playerFilterTeam}
    onChange={(e) => setPlayerFilterTeam(e.target.value)}
  >
    <option value="">Tüm Takımlar</option>

    {teams.map((t) => (
      <option key={t.id} value={t.id}>
        {t.name}
      </option>
    ))}
  </select>
</div>

<div className="cards">
  {filteredPlayers.map((p) => (
                <div className="teamCard" key={p.id}>
                  <div className="playerAvatar">{p.name?.[0]}</div>
                  <h2>{p.name}</h2>
                  <p>{getTeamName(p.team_id)}</p>

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
                {upcoming.map((m) => (
                  <MatchCard key={m.id} match={m} getTeam={getTeam} formatDate={formatDate} />
                ))}
              </Panel>

              <Panel title="Geçmiş Maçlar">
                {past.map((m) => (
                  <div className="pastMatch" key={m.id}>
                    <b>{getTeamName(m.home_id)} {m.home_score} - {m.away_score} {getTeamName(m.away_id)}</b>
                    <small>{formatDate(m.match_date)} / {m.field || "-"}</small>
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
              <Panel title="Takım Ekle / Güncelle / Sil">
                <input placeholder="Takım adı" value={teamForm.name} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} />
                <input placeholder="Takım başkanı" value={teamForm.president} onChange={(e) => setTeamForm({ ...teamForm, president: e.target.value })} />

                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    fileToBase64(file, (logo) => setTeamForm({ ...teamForm, logo }));
                  }}
                />

                <button onClick={addTeam}>Takım Ekle</button>

                {teams.map((t) => (
                  <div className="teamEditBox" key={t.id}>
                    <div className="teamEditTop">
                      <Logo team={t} />
                      <b>{t.name}</b>
                    </div>

                    <input value={t.name || ""} onChange={(e) => updateTeam(t.id, { name: e.target.value })} />
                    <input value={t.president || ""} onChange={(e) => updateTeam(t.id, { president: e.target.value })} />

                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        fileToBase64(file, (logo) => updateTeam(t.id, { logo }));
                      }}
                    />

                    <button className="danger" onClick={() => deleteTeam(t.id)}>Sil</button>
                  </div>
                ))}
              </Panel>

              <Panel title="Oyuncu Ekle / Sil">
                <input placeholder="Oyuncu adı" value={playerForm.name} onChange={(e) => setPlayerForm({ ...playerForm, name: e.target.value })} />

                <select value={playerForm.team_id} onChange={(e) => setPlayerForm({ ...playerForm, team_id: e.target.value })}>
                  <option value="">Takım seç</option>
                  {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>

                <input placeholder="Mevki" value={playerForm.position} onChange={(e) => setPlayerForm({ ...playerForm, position: e.target.value })} />
                <input placeholder="Forma no" value={playerForm.number} onChange={(e) => setPlayerForm({ ...playerForm, number: e.target.value })} />
                <input placeholder="Güçlü ayak" value={playerForm.foot} onChange={(e) => setPlayerForm({ ...playerForm, foot: e.target.value })} />
                <input type="number" placeholder="Asist" value={playerForm.assists} onChange={(e) => setPlayerForm({ ...playerForm, assists: e.target.value })} />

                <button onClick={addPlayer}>Oyuncu Ekle</button>

                {players.map((p) => (
                  <div className="adminRow" key={p.id}>
                    <span>{p.name}</span>
                    <button className="danger" onClick={() => deletePlayer(p.id)}>Sil</button>
                  </div>
                ))}
              </Panel>

              <Panel title="Maç Ekle / Düzenle / Sil">
                <select value={matchForm.home_id} onChange={(e) => setMatchForm({ ...matchForm, home_id: e.target.value })}>
                  <option value="">Ev sahibi</option>
                  {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>

                <select value={matchForm.away_id} onChange={(e) => setMatchForm({ ...matchForm, away_id: e.target.value })}>
                  <option value="">Deplasman</option>
                  {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>

                <input type="datetime-local" value={matchForm.match_date} onChange={(e) => setMatchForm({ ...matchForm, match_date: e.target.value })} />
                <input placeholder="Saha adı" value={matchForm.field} onChange={(e) => setMatchForm({ ...matchForm, field: e.target.value })} />

                <button onClick={addMatch}>Maç Ekle</button>

                {matches.map((m) => (
                  <div className="editMatch" key={m.id}>
                    <select value={m.home_id} onChange={(e) => updateMatch(m.id, { home_id: e.target.value })}>
                      {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>

                    <select value={m.away_id} onChange={(e) => updateMatch(m.id, { away_id: e.target.value })}>
                      {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>

                    <input type="datetime-local" value={m.match_date || ""} onChange={(e) => updateMatch(m.id, { match_date: e.target.value })} />
                    <input value={m.field || ""} onChange={(e) => updateMatch(m.id, { field: e.target.value })} />

                    <button className="danger" onClick={() => deleteMatch(m.id)}>Sil</button>
                  </div>
                ))}
              </Panel>

              <Panel title="Gelecek Maçı Sonlandır">
                <select value={finishId} onChange={(e) => setFinishId(e.target.value)}>
                  <option value="">Maç seç</option>
                  {upcoming.map((m) => (
                    <option key={m.id} value={m.id}>
                      {getTeamName(m.home_id)} - {getTeamName(m.away_id)}
                    </option>
                  ))}
                </select>

                <div className="scoreInputs">
                  <input placeholder="Ev skor" value={finishScore.home_score} onChange={(e) => setFinishScore({ ...finishScore, home_score: e.target.value })} />
                  <input placeholder="Dep skor" value={finishScore.away_score} onChange={(e) => setFinishScore({ ...finishScore, away_score: e.target.value })} />
                </div>

                <button onClick={() => setFinishScorers([...finishScorers, ""])}>Gol Atan Oyuncu Ekle</button>
                {finishScorers.map((v, i) => (
                  <select key={i} value={v} onChange={(e) => {
                    const arr = [...finishScorers];
                    arr[i] = e.target.value;
                    setFinishScorers(arr);
                  }}>
                    <option value="">Oyuncu seç</option>
                    {matchPlayers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                ))}

                <button onClick={() => setFinishYellows([...finishYellows, ""])}>Sarı Kart Ekle</button>
                {finishYellows.map((v, i) => (
                  <select key={i} value={v} onChange={(e) => {
                    const arr = [...finishYellows];
                    arr[i] = e.target.value;
                    setFinishYellows(arr);
                  }}>
                    <option value="">Oyuncu seç</option>
                    {matchPlayers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                ))}

                <button onClick={() => setFinishReds([...finishReds, ""])}>Kırmızı Kart Ekle</button>
                {finishReds.map((v, i) => (
                  <select key={i} value={v} onChange={(e) => {
                    const arr = [...finishReds];
                    arr[i] = e.target.value;
                    setFinishReds(arr);
                  }}>
                    <option value="">Oyuncu seç</option>
                    {matchPlayers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                ))}

                <button className="finish" onClick={finishMatch}>Maçı Sonlandır</button>
              </Panel>

              <Panel title="Manuel Puan Düzeltme">
                {standings.map((t) => (
                  <div className="manualBox" key={t.id}>
                    <b>{t.name} {t.manual ? "(Manuel)" : "(Otomatik)"}</b>

                    {["played", "wins", "draws", "losses", "gf", "ga", "pts"].map((k) => (
                      <input key={k} type="number" placeholder={k} value={t[k]} onChange={(e) => setManualStat(t.id, k, e.target.value)} />
                    ))}

                    <button onClick={() => resetManual(t.id)}>Otomatiğe Al</button>
                  </div>
                ))}
              </Panel>
            </div>
          </Page>
        )}
        {selectedTeamDetail && (
  <div
    className="modalOverlay"
    onClick={() => setSelectedTeamDetail(null)}
  >
    <div
      className="teamModal"
      onClick={(e) => e.stopPropagation()}
    >
      <Logo team={selectedTeamDetail} />

      <h2>{selectedTeamDetail.name}</h2>

      <p>
        Başkan: {selectedTeamDetail.president || "-"}
      </p>

      <div className="stats">
        <Stat
          label="Puan"
          value={selectedTeamDetail.pts}
          green
        />

        <Stat
          label="Galibiyet"
          value={selectedTeamDetail.wins}
        />

        <Stat
          label="Beraberlik"
          value={selectedTeamDetail.draws}
        />

        <Stat
          label="Mağlubiyet"
          value={selectedTeamDetail.losses}
        />
      </div>

      <h3>Oyuncular</h3>

      {players
        .filter(
          (p) => p.team_id === selectedTeamDetail.id
        )
        .map((p) => (
          <div className="adminRow" key={p.id}>
            <span>{p.name}</span>
            <span>{p.position || "-"}</span>
          </div>
        ))}

      <button
        onClick={() => setSelectedTeamDetail(null)}
      >
        Kapat
      </button>
    </div>
  </div>
)}
      </main>
      <div className="mobileNav">
  <button onClick={() => setPage("home")}>Ana Sayfa</button>
  <button onClick={() => setPage("teams")}>Takımlar</button>
  <button onClick={() => setPage("players")}>Oyuncular</button>
  <button onClick={() => setPage("matches")}>Maçlar</button>
  <button onClick={() => setPage("admin")}>Admin</button>
</div>
    </div>
  );
}

function Logo({ team }) {
  return (
    <div className="logoBox">
      {team?.logo ? <img src={team.logo} alt={team.name} /> : <span>{team?.name?.[0] || "?"}</span>}
    </div>
  );
}

function MatchCard({ match, getTeam, formatDate, title }) {
  if (!match) {
    return (
      <div className="matchCard">
        <h3>{title || "Maç"}</h3>
        <p>Henüz maç eklenmedi.</p>
      </div>
    );
  }

  const home = getTeam(match.home_id);
  const away = getTeam(match.away_id);

  return (
    <div className="matchCard">
      {title && <h3>{title}</h3>}

      <div className="versus">
        <div className="club">
          <Logo team={home} />
          <b>{home?.name}</b>
        </div>

        <strong>
          {match.finished
            ? `${match.home_score} - ${match.away_score}`
            : "VS"}
        </strong>

        <div className="club">
          <b>{away?.name}</b>
          <Logo team={away} />
        </div>
      </div>

      <p>{match.finished ? "MAÇ SONA ERDİ" : formatDate(match.match_date)}</p>
      <small>{match.field || "-"}</small>

      {match.finished && (
        <div className="matchEvents">
          <p>Goller: {(match.scorers || []).map((id) => id).length || 0}</p>
        </div>
      )}
    </div>
  );
}
function Standings({ teams, onTeamClick }) {
  return (
    <div className="panel">
      <h2>Puan Durumu</h2>

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Takım</th>
            <th>O</th>
            <th>G</th>
            <th>B</th>
            <th>M</th>
            <th>AG</th>
            <th>YG</th>
            <th>AV</th>
            <th>P</th>
          </tr>
        </thead>

        <tbody>
          {teams.map((t, i) => (
            <tr key={t.id}>
              <td>{i + 1}</td>

              <td>
                <button
                  className="teamLink"
                  onClick={() => onTeamClick(t)}
                >
                  {t.name}
                </button>
              </td>

              <td>{t.played}</td>
              <td>{t.wins}</td>
              <td>{t.draws}</td>
              <td>{t.losses}</td>
              <td>{t.gf}</td>
              <td>{t.ga}</td>
              <td>{t.gf - t.ga}</td>
              <td><b>{t.pts}</b></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Page({ title, children }) {
  return (
    <>
      <div className="pageTitle">
        <span className="badge">ALİŞAR SÜPERLİG</span>
        <h1>{title}</h1>
      </div>

      {children}
    </>
  );
}

function Panel({ title, children }) {
  return (
    <div className="panel">
      <h2>{title}</h2>
      {children}
    </div>
  );
}

function Stat({ label, value, green }) {
  return (
    <div className={green ? "stat green" : "stat"}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}