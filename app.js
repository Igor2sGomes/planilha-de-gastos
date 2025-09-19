document.getElementById("btnAddMes").addEventListener("click", adicionarMes);
document.getElementById("btnGerar").addEventListener("click", gerarPDFMultiMes);

function adicionarMes(){
  const container = document.getElementById("mesesContainer");
  const novoMes = container.querySelector(".mesSection").cloneNode(true);
  // Limpar inputs
  novoMes.querySelectorAll("input").forEach(input=>input.value="");
  novoMes.querySelectorAll("tbody").forEach(tbody=>tbody.innerHTML="");
  container.appendChild(novoMes);
}

function adicionarLinha(botao){
  const tabela = botao.previousElementSibling || botao.parentElement.querySelector("table tbody");
  const colunas = tabela.querySelectorAll("thead th").length;
  const tr = document.createElement("tr");
  for(let i=0;i<colunas;i++){
    const td = document.createElement("td");
    const input = document.createElement("input");
    input.type = i===colunas-1?"number":"text";
    td.appendChild(input);
    tr.appendChild(td);
  }
  tabela.querySelector("tbody").appendChild(tr);
}

function pegarDadosTabela(tabela){
  const linhas = Array.from(tabela.querySelectorAll("tbody tr"));
  return linhas.map(tr=>Array.from(tr.querySelectorAll("input")).map(i=>i.value))
               .filter(l=>l.some(c=>c.trim()!==""));
}

function somarColuna(dados, indice){
  return dados.reduce((total, linha) => total + (parseFloat(linha[indice])||0), 0);
}

function somarPorCategoria(dados, indiceCategoria, indiceValor){
  const categorias = {};
  dados.forEach(d=>{
    const cat=d[indiceCategoria]||"Outros";
    const val=parseFloat(d[indiceValor])||0;
    categorias[cat]=(categorias[cat]||0)+val;
  });
  return categorias;
}

async function gerarPDFMultiMes() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation:'landscape' });

  const mesesSections = document.querySelectorAll(".mesSection");
    for(let m=0; m<mesesSections.length; m++) {
      if(m>0) doc.addPage();
      const sec = mesesSections[m];
      const mesInput = sec.querySelector("input[type=month]").value;
      const mesTexto = mesInput ? `Mês: ${mesInput}` : `Mês ${m+1}`;

      doc.setFontSize(18);
      doc.text('Planilha Financeira',14,20);
      doc.setFontSize(12);
      doc.text(mesTexto,14,28);

      // Receitas
      doc.setFontSize(14);
      doc.text('Receitas',14,35);
      const tabelaReceitas = sec.querySelector(".tabelaReceitas");
      const receitas = pegarDadosTabela(tabelaReceitas);
      doc.autoTable({ startY:38, head:[["Data","Descrição","Categoria","Valor (R$)"]],
        body: receitas.length?receitas:[["","","",""]],
        styles:{fontSize:9, halign:'center'},
        headStyles:{fillColor:[46,184,92], textColor:255, fontStyle:'bold'},
        alternateRowStyles:{fillColor:[230,255,230]}
      });
      const catReceitas = somarPorCategoria(receitas,2,3);
      let yCatReceitas = doc.lastAutoTable.finalY + 5;
      Object.keys(catReceitas).forEach(cat=>{
        doc.setFontSize(11);
        doc.text(`${cat}: R$ ${catReceitas[cat].toFixed(2)}`,14,yCatReceitas);
        yCatReceitas += 6;
      });

      // Despesas
      let yDesp = yCatReceitas + 10;
      doc.text('Despesas',14,yDesp);
      const tabelaDespesas = sec.querySelector(".tabelaDespesas");
      const despesas = pegarDadosTabela(tabelaDespesas);
      doc.autoTable({ startY:yDesp+3, head:[["Data","Descrição","Categoria","Forma de Pagamento","Valor (R$)"]],
        body: despesas.length?despesas:[["","","","",""]],
        styles:{fontSize:9, halign:'center'},
        headStyles:{fillColor:[200,0,0], textColor:255, fontStyle:'bold'},
        alternateRowStyles:{fillColor:[255,230,230]}
      });
      const catDespesas = somarPorCategoria(despesas,2,4);
      let yCatDespesas = doc.lastAutoTable.finalY + 5;
      Object.keys(catDespesas).forEach(cat=>{
        doc.setFontSize(11);
        doc.text(`${cat}: R$ ${catDespesas[cat].toFixed(2)}`,14,yCatDespesas);
        yCatDespesas += 6;
      });

      // Resumo
      const totalReceitas = somarColuna(receitas,3);
      const totalDespesas = somarColuna(despesas,4);
      const saldo = totalReceitas - totalDespesas;
      let yResumo = yCatDespesas + 10;
      doc.setFontSize(12);
      doc.text('Resumo Financeiro',14,yResumo);
      doc.setFontSize(11);
      doc.text(`Total de Receitas: R$ ${totalReceitas.toFixed(2)}`,14,yResumo+8);
      doc.text(`Total de Despesas: R$ ${totalDespesas.toFixed(2)}`,14,yResumo+16);
      doc.text(`Saldo: R$ ${saldo.toFixed(2)}`,14,yResumo+24);

      // Gráfico pizza despesas
      if(despesas.length){
        const labels = Object.keys(catDespesas);
        const valores = Object.values(catDespesas);
        const total = valores.reduce((s,v)=>s+v,0);
        const percentuais = valores.map(v=>((v/total)*100).toFixed(1)+"%");

        const canvas = document.getElementById("graficoDespesas");
        if(window.grafico) window.grafico.destroy();
        window.grafico = new Chart(canvas,{ type:'pie',
          data:{labels:labels, datasets:[{data:valores, backgroundColor:["#FF6384","#36A2EB","#FFCE56","#8A2BE2","#00FF7F","#FF4500"]}]},
          options:{responsive:false, plugins:{legend:{position:'right', labels:{generateLabels:chart=>{
            return chart.data.labels.map((label,i)=>({text:`${label}: ${percentuais[i]}`, fillStyle: chart.data.datasets[0].backgroundColor[i]}));
          }}}}}
        });
        await new Promise(res=>setTimeout(res,200));
        const imgData = canvas.toDataURL("image/png");
        doc.addPage();
        doc.setFontSize(16);
        doc.text(`Distribuição de Despesas - ${mesTexto}`,14,20);
        doc.addImage(imgData,'PNG',20,30,250,150);
      }

      // Gráfico barras receitas x despesas
      const canvasBar = document.getElementById("graficoComparativo");
      if(window.graficoBar) window.graficoBar.destroy();
      window.graficoBar = new Chart(canvasBar, {
        type: 'bar',
        data: {
          labels: ['Receitas', 'Despesas'],
          datasets: [{
            label: 'Valores (R$)',
            data: [totalReceitas, totalDespesas],
            backgroundColor: ['#36A2EB', '#FF6384']
          }]
        },
        options: {
          responsive: false,
          plugins: {
            legend: { display: false }
          }
        }
      });
    }
    doc.setFontSize(18);
    doc.text('Planilha Financeira',14,20);
    doc.setFontSize(12);
    // ...existing code...

    // Resumo
    const totalReceitas = somarColuna(receitas,3);
    const totalDespesas = somarColuna(despesas,4);
    const saldo = totalReceitas - totalDespesas;
    let yResumo = yCatDespesas + 10;
    doc.setFontSize(12);
    doc.text('Resumo Financeiro',14,yResumo);
    doc.setFontSize(11);
    doc.text(`Total de Receitas: R$ ${totalReceitas.toFixed(2)}`,14,yResumo+8);
    doc.text(`Total de Despesas: R$ ${totalDespesas.toFixed(2)}`,14,yResumo+16);
    doc.text(`Saldo: R$ ${saldo.toFixed(2)}`,14,yResumo+24);

    // Gráfico pizza despesas
    if(despesas.length){
      const labels = Object.keys(catDespesas);
      const valores = Object.values(catDespesas);
      const total = valores.reduce((s,v)=>s+v,0);
      const percentuais = valores.map(v=>((v/total)*100).toFixed(1)+"%");

      const canvas = document.getElementById("graficoDespesas");
      if(window.grafico) window.grafico.destroy();
      window.grafico = new Chart(canvas,{ type:'pie',
        data:{labels:labels, datasets:[{data:valores, backgroundColor:["#FF6384","#36A2EB","#FFCE56","#8A2BE2","#00FF7F","#FF4500"]}]},
        options:{responsive:false, plugins:{legend:{position:'right', labels:{generateLabels:chart=>{
          return chart.data.labels.map((label,i)=>({text:`${label}: ${percentuais[i]}`, fillStyle: chart.data.datasets[0].backgroundColor[i]}));
        }}}}}
      });
      await new Promise(res=>setTimeout(res,200));
      const imgData = canvas.toDataURL("image/png");
      doc.addPage();
      doc.setFontSize(16);
      doc.text(`Distribuição de Despesas - ${mesTexto}`,14,20);
      doc.addImage(imgData,'PNG',20,30,250,150);
    }

    // Gráfico barras receitas x despesas
    const canvasBar = document.getElementById("graficoComparativo");
    if(window.graficoBar) window.graficoBar.destroy();
    window.graficoBar = new Chart(canvasBar, {
      type: 'bar',
      data: {
        labels: ['Receitas', 'Despesas'],
        datasets: [{
          label: 'Valores (R$)',
          data: [totalReceitas, totalDespesas],
          backgroundColor: ['#36A2EB', '#FF6384']
        }]
      },
      options: {
        responsive: false,
        plugins: {
          legend: { display: false }
        }
      }
  });
}
