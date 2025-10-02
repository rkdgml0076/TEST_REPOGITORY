
document.addEventListener('keydown', function (e) {
  if (e.keyCode === 123) { e.preventDefault(); alert('Error'); }
  if (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) { e.preventDefault(); alert('Error'); }
  if (e.ctrlKey && e.keyCode === 85) { e.preventDefault(); alert('Error'); }
});

// 내부 상태
let latestNodesData = null; // 가장 최근 호출 결과
let nodesDataList = [];     // 여러 호출 결과 누적 (Fetch All용)
let parsedRows = [];        // Excel에서 읽어온 {siteId, grtId} 배열

// 공통: API 호출 함수 (grtId, siteId 받음)
async function fetchDataFor(grtId, siteId) {
  const url = `https://dfm-ct.watergrid.kr/api?grtId=${encodeURIComponent(grtId)}&siteId=${encodeURIComponent(siteId)}`;
  document.getElementById("urlDisplay").innerHTML = `<a href="${url}" target="_blank">${url}</a>`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const result = await resp.json();
    // 최근 결과 저장
    latestNodesData = { inputGrt: grtId, inputSite: siteId, result };
    // 누적 리스트에도 저장
    nodesDataList.push(latestNodesData);
    // 화면 출력(간단)
    document.getElementById("output").textContent = JSON.stringify(latestNodesData, null, 2);
    return latestNodesData;
  } catch (err) {
    alert("데이터를 불러오는 중 오류 발생: " + err.message);
    return { inputGrt: grtId, inputSite: siteId, error: err.message };
  }
}

function downloadTemplate() {
    // 엑셀 시트 데이터 (헤더만 설정)
    let worksheetData = [
    ["IMEI", "지자체"]  // 첫 번째 행: 헤더
    ];

    // 워크시트와 워크북 생성
    let ws = XLSX.utils.aoa_to_sheet(worksheetData);
    let wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ImportTemplate");

    // 파일 다운로드
    XLSX.writeFile(wb, "import_template.xlsx");
}

document.getElementById('fetchBtn').addEventListener('click', async () => {
  const grtId = document.getElementById('grtIdInput').value.trim();
  const siteId = document.getElementById('siteIdInput').value.trim();
  if (!grtId || !siteId) {
    alert("IMEI와 지자체를 입력/선택하세요.");
    return;
  }
  await fetchDataFor(grtId, siteId);
});

document.getElementById('excelInput').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    const data = new Uint8Array(ev.target.result);
    const wb = XLSX.read(data, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    const imeiKeys = ['imei','IMEI','grtId','grt_id','grt id','grt','grtid','grtId'];
    const siteKeys = ['site','siteId','site_id','site id','지자체','siteid','site_id','siteName','site_name','site name'];
    parsedRows = raw.map((row, idx) => {
      let imeiVal = '';
      let siteVal = '';
      for (const k of Object.keys(row)) {
        const kn = k.replace(/\s+/g,'').toLowerCase();
        if (imeiKeys.map(x=>x.toLowerCase().replace(/\s+/g,'')).includes(kn)) imeiVal = row[k];
        if (siteKeys.map(x=>x.toLowerCase().replace(/\s+/g,'')).includes(kn)) siteVal = row[k];
      }
      // Also try direct keys if not found
      if (!imeiVal && (row['IMEI'] || row['imei'] || row['grtId'] || row['grt_id'])) {
        imeiVal = row['IMEI'] || row['imei'] || row['grtId'] || row['grt_id'];
      }
      if (!siteVal && (row['site'] || row['siteId'] || row['site_id'])) {
        siteVal = row['site'] || row['siteId'] || row['site_id'];
      }
      return {
        original: row,
        site: String(siteVal).trim(),
        imei: String(imeiVal).trim(),
        index: idx
      };
    });

    renderParsedTable();
  };
  reader.readAsArrayBuffer(file);
});

function renderParsedTable() {
  const tbody = document.querySelector('#parsedTable tbody');
  tbody.innerHTML = '';
  parsedRows.forEach((r, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${escapeHtml(r.site)}</td>
      <td>${escapeHtml(r.imei)}</td>
      <td>
        <button class="btn-primary small" data-idx="${i}" onclick="setAndFetch(${i})">데이터 호출하기</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// 안전한 HTML 엔티티 처리
function escapeHtml(s) {
  if (s === undefined || s === null) return '';
  return String(s).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];});
}

async function setAndFetch(idx) {
  const row = parsedRows[idx];
  if (!row) { alert("해당 행을 찾을 수 없습니다."); return; }

  // 1) inputs에 채우기
  document.getElementById('grtIdInput').value = row.imei || '';
  // site 셀렉트 매핑 시도
  const select = document.getElementById('siteIdInput');
  let setted = false;
  if (row.site) {
    for (let i=0;i<select.options.length;i++){
      if (select.options[i].value.toLowerCase() === String(row.site).toLowerCase()){
        select.selectedIndex = i; setted = true; break;
      }
    }
    if (!setted) {
      for (let i=0;i<select.options.length;i++){
        if (select.options[i].text.toLowerCase() === String(row.site).toLowerCase()){
          select.selectedIndex = i; setted = true; break;
        }
      }
    }
  }

  // 2) fetch 호출 (site 매핑 실패 시 select의 현재값 사용)
  let finalSite = setted ? select.options[select.selectedIndex].value : (row.site || select.value);
  const imei = row.imei || document.getElementById('grtIdInput').value;
  if (!imei || !finalSite) {
    alert("IMEI 또는 지자체 값이 없습니다. Excel 데이터를 확인하세요.");
    return;
  }
  await fetchDataFor(imei, finalSite);
}

document.getElementById('fetchAllBtn').addEventListener('click', async () => {
  if (!parsedRows || parsedRows.length === 0) { alert("선택된 Excel 파일이 없습니다."); return; }
  if (!confirm(`총 ${parsedRows.length}건을 순차적으로 호출합니다. 진행할까요?`)) return;
  nodesDataList = [];
  for (let i=0;i<parsedRows.length;i++){
    const r = parsedRows[i];
    let site = r.site || document.getElementById('siteIdInput').value;
    const imei = r.imei || document.getElementById('grtIdInput').value;
    if (!imei) {
      nodesDataList.push({ inputGrt: imei, inputSite: site, error: 'IMEI missing' });
      continue;
    }
    const select = document.getElementById('siteIdInput');
    let finalSite = site;
    let found = false;
    for (let j=0;j<select.options.length;j++){
      if (select.options[j].value.toLowerCase() === String(site).toLowerCase()) { finalSite = select.options[j].value; found = true; break; }
    }
    if (!found) {
      for (let j=0;j<select.options.length;j++){
        if (select.options[j].text.toLowerCase() === String(site).toLowerCase()) { finalSite = select.options[j].value; found = true; break; }
      }
    }
    const res = await fetchDataFor(imei, finalSite);
  }
  alert('데이터 호출 완료. 결과는 "API 전체 조회 데이터 다운로드"로 엑셀 저장하세요.');
});

document.getElementById('downloadAllResults').addEventListener('click', () => {
  if (!nodesDataList || nodesDataList.length === 0) { alert('저장할 결과가 없습니다. 먼저 호출을 진행하세요.'); return; }
 const flat = nodesDataList.map((item, idx) => {
  const nodes = item.result?.nodes || {};

    return {
      idx: idx + 1,
      error: item.error || '',
      지자체: item.inputSite || '',
      IMEI: item.inputGrt || '',
      IMSI: nodes.imsi || '',
      // result.nodes 안에서 뽑아오기
      검침날짜: nodes.date || '',
      일련번호: nodes.msrNo || '',
      RSRP: nodes.rsrp ?? '',
      검침값: nodes.msrValue ?? '',
      계량기번호: nodes.meterNo || '', 

      // result_json: item.result ? JSON.stringify(item.result) : '',
    };
  });
    const ws = XLSX.utils.json_to_sheet(flat);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'AllResults');
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 19).replace(/[-T:]/g, '');
    XLSX.writeFile(wb, `AllResults_${dateStr}.xlsx`);
});

function downloadExcel() {
  let payload = null;
  if (nodesDataList && nodesDataList.length > 0) {
    payload = nodesDataList.map((item, idx) => ({
    idx: idx + 1,
    error: item.error || '',
    지자체: item.inputSite || '',
    IMEI: item.inputGrt || '',
    IMSI: nodes.imsi || '',
    // result.nodes 안에서 뽑아오기
    검침날짜: nodes.date || '',
    일련번호: nodes.msrNo || '',
    RSRP: nodes.rsrp ?? '',
    검침값: nodes.msrValue ?? '',
    계량기번호: nodes.meterNo || '',

    // result_json: item.result ? JSON.stringify(item.result) : '',
    }));
    } else if (latestNodesData) {
      payload = [{
        inputSite: latestNodesData.inputSite,
        inputGrt: latestNodesData.inputGrt,
        result_json: latestNodesData.result ? JSON.stringify(latestNodesData.result) : ''
      }];
    } else {
      alert("먼저 데이터를 가져오세요.");
      return;
    }
}