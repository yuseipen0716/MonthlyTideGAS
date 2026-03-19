/**
 * 天文周期（朔望月）に基づき、補正を加えた正確な潮汐名称を返す
 * 気象庁潮位表README: https://www.data.jma.go.jp/kaiyou/db/tide/suisan/readme.html
 * 気象庁潮位表掲載地点一覧表: https://www.data.jma.go.jp/kaiyou/db/tide/suisan/station2025.php
 */
function getTideNameByAstronomy(date) {
  // 1. 基準となる新月（2000年1月6日 18:14 JST）
  const baseDate = new Date(2000, 0, 6, 18, 14);
  const synodicMonth = 29.530589; // 平均朔望月
  
  // 2. 経過日数を計算
  const diffTime = date.getTime() - baseDate.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  
  // 3. 月齢を算出（+1.0の補正値を加えて世の中のカレンダーに合わせる）
  const age = (diffDays + 1.0) % synodicMonth;

  // 4. 潮汐判別テーブル（気象庁/海上保安庁等の基準に準拠）
  // 大潮は新月・満月の前後4日間程度
  if (age < 2.5 || age >= 28.5) return "大潮"; 
  if (age < 6.5)  return "中潮";
  if (age < 9.5)  return "小潮";
  if (age < 10.5) return "長潮";
  if (age < 11.5) return "若潮";
  if (age < 13.5) return "中潮";
  if (age < 17.5) return "大潮"; // 15前後（満月）は大潮
  if (age < 21.5) return "中潮";
  if (age < 24.5) return "小潮";
  if (age < 25.5) return "長潮";
  if (age < 26.5) return "若潮";
  return "中潮";
}

function updateMonthlyTideMikawa() {
  const CALENDAR_NAME = "潮汐"; 
  const POINT_CODE = "G4";
  const calendar = CalendarApp.getCalendarsByName(CALENDAR_NAME)[0];
  if (!calendar) return console.error("カレンダーが見つかりません");

  const now = new Date();
  const year = 2026; 
  const month = 3; 

  const url = `https://www.data.jma.go.jp/kaiyou/data/db/tide/suisan/txt/${year}/${POINT_CODE}.txt`;
  
  try {
    const response = UrlFetchApp.fetch(url);
    const lines = response.getContentText().split('\n');

    lines.forEach(line => {
      if (line.indexOf(POINT_CODE) === -1 || line.length < 100) return;

      const fMonth = parseInt(line.substring(74, 76).trim());
      const fDay   = parseInt(line.substring(76, 78).trim());
      if (fMonth !== month) return;

      const targetDate = new Date(year, month - 1, fDay);
      const tideName = getTideNameByAstronomy(targetDate);

      // --- データ解析 (固定長切り出し) ---
      let hourly = [];
      for (let i = 0; i < 24; i++) {
        let val = line.substring(i * 3, (i + 1) * 3).trim();
        hourly.push(`${i}時:${val}cm`);
      }

      const dataPart = line.substring(80); 
      const parseTide = (startIdx) => {
        let res = [];
        for (let i = 0; i < 4; i++) {
          let p = startIdx + (i * 7);
          let time = dataPart.substring(p, p + 4).replace(/\s/g, '0');
          let level = dataPart.substring(p + 4, p + 7).trim();
          if (time !== "9999" && time !== "0000" && level !== "") {
            res.push(`${parseInt(time.substring(0,2),10)}:${time.substring(2,4)} (${level}cm)`);
          }
        }
        return res;
      };

      const highTides = parseTide(0);
      const lowTides  = parseTide(28);

      const title = `潮汐(三河): ${fDay}日 【${tideName}】`;
      const description = `<満潮>\n${highTides.join("\n") || "なし"}\n\n<干潮>\n${lowTides.join("\n") || "なし"}\n\n<毎時潮位>\n${hourly.join(", ")}`;

      const oldEvents = calendar.getEventsForDay(targetDate);
      oldEvents.forEach(ev => { if (ev.getTitle().includes("潮汐")) ev.deleteEvent(); });
      calendar.createAllDayEvent(title, targetDate, {description: description});
    });

    console.log(`2026年3月分を補正済み天文ロジックで登録しました。`);
  } catch (e) {
    console.error("エラー: " + e.message);
  }
}
