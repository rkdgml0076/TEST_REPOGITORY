document.addEventListener('keydown', function (e) {
  // F12
  if (e.keyCode === 123) {
    e.preventDefault();
    alert('Error');
  }

  // Ctrl + Shift + I/J/C
  if (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) {
    e.preventDefault();
    alert('Error');
  }

  // Ctrl + U
  if (e.ctrlKey && e.keyCode === 85) {
    e.preventDefault();
    alert('Error');
  }
});

let nodesData = [];
document.getElementById('fetchBtn').addEventListener('click', async () => {
const grtId = document.getElementById('grtIdInput').value.trim();
const siteId = document.getElementById('siteIdInput').value.trim();
if (!grtId || !siteId) {
  alert("IMEI�� �Է��ϼ���.");
  return;
}
const url = `https://dfm-ct.watergrid.kr/api?grtId=${encodeURIComponent(grtId)}&siteId=${encodeURIComponent(siteId)}`;

const urlDisplay = document.getElementById("urlDisplay");
urlDisplay.innerHTML = `<a href="${url}" target="_blank">${url}</a>`;

    try {
      const response = await fetch(url);
      const result = await response.json();

      nodesData = result.nodes;  // ���� ���� ������Ʈ

      document.getElementById("output").textContent = JSON.stringify(nodesData, null, 2);
    } 
    catch (error) {
      alert("�����͸� �ҷ����� �� ���� �߻�: " + error.message);
    }
});

function downloadExcel() {
  if (!nodesData || Object.keys(nodesData).length === 0) {
    alert("���� �����͸� ����������.");
    return;
  }
  
  // if (!Array.isArray(nodesData)) {
  //   alert("�ٿ�ε��� �����Ͱ� �迭 ������ �ƴմϴ�.");
  //   console.log("nodesData ����:", nodesData);
  //   return;
  // }

  console.log("�ٿ�ε� �Լ� �����");
  console.log("nodesData:", nodesData);
  
  // �迭 ��ü�� ��Ʈ�� ��ȯ
  const worksheet = XLSX.utils.json_to_sheet([nodesData]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "NodesData");

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 19).replace(/[-T:]/g, '');

  XLSX.writeFile(workbook, `nodesData_${dateStr}.xlsx`);
}