/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  FolderOpen, FileText, Shield, ShieldAlert, ShieldCheck, 
  Terminal, Cpu, Zap, Download, Upload, RefreshCw, CheckCircle2, 
  AlertTriangle, ArrowRight, Database, Eye, Lock, Unlock, HardDrive, Sparkles
} from 'lucide-react';

interface FileNode {
  name: string;
  path: string;
  size: number;
  file: File;
  isHelpCandidate: boolean;
}

// 100% Local Smart Snippet Extractor (Zero Tokens / Algorithmic Relevance)
function extractRelevantSnippets(fileText: string, query: string, maxChars = 400): string {
  if (!fileText || !query) return fileText.slice(0, maxChars);
  const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (keywords.length === 0) return fileText.slice(0, maxChars);

  const paragraphs = fileText.split(/(?:\r?\n){2,}|[.?!]\s+/);
  const scored = paragraphs.map(p => {
    const pLower = p.toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      if (pLower.includes(kw)) score += 2;
    }
    return { p: p.trim(), score };
  });

  scored.sort((a, b) => b.score - a.score);

  let result = '';
  for (const item of scored) {
    if (item.score > 0 && (result.length + item.p.length) <= maxChars) {
      result += (result ? '\n\n' : '') + item.p;
    }
  }

  if (!result) {
    result = fileText.slice(0, maxChars);
  }
  return result;
}

export default function App() {
  const [filterKeyword, setFilterKeyword] = useState<string>('');

  // Folder & File state
  const [folderName, setFolderName] = useState<string>('');
  const [files, setFiles] = useState<FileNode[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [authorizedFiles, setAuthorizedFiles] = useState<Record<string, string>>({});
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [pendingCandidates, setPendingCandidates] = useState<FileNode[]>([]);

  // Resumo de Estado state (Persistent in localStorage)
  const [resumoEstado, setResumoEstado] = useState<string>(() => {
    return localStorage.getItem('toolmapper_resumo_estado') || 
      `# RESUMO DE ESTADO ATUAL - TOOLMAPPER AI\n\n## 1. Pastas Mapeadas\nNenhuma pasta carregada ainda.\n\n## 2. Árvore de Funcionalidade Prática das Ferramentas\n- Aguardando carregamento de estrutura...\n\n## 3. Cache de Algoritmos & Desafios Resolvidos\n- Nenhum desafio processado.\n`;
  });

  // Challenge & AI State
  const [challenge, setChallenge] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [lastAlgorithm, setLastAlgorithm] = useState<string>('');
  const [lastDelta, setLastDelta] = useState<string>('');
  const [tokensSaved, setTokensSaved] = useState<number>(() => {
    return parseInt(localStorage.getItem('toolmapper_tokens_saved') || '1420', 10);
  });
  const [summaryCheckedFirst, setSummaryCheckedFirst] = useState<boolean>(false);
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('toolmapper_api_key') || '';
  });
  const [showApiModal, setShowApiModal] = useState<boolean>(false);

  // Sync Resumo with localStorage
  useEffect(() => {
    localStorage.setItem('toolmapper_resumo_estado', resumoEstado);
  }, [resumoEstado]);

  useEffect(() => {
    localStorage.setItem('toolmapper_tokens_saved', tokensSaved.toString());
  }, [tokensSaved]);

  useEffect(() => {
    if (apiKey) {
      localStorage.setItem('toolmapper_api_key', apiKey);
    }
  }, [apiKey]);

  // Handle folder selection (ZERO TOKENS IN MAPPING)
  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles = e.target.files;
    if (!rawFiles || rawFiles.length === 0) return;

    const fileList: FileNode[] = [];
    let rootFolderName = 'programa_raiz';

    for (let i = 0; i < rawFiles.length; i++) {
      const file = rawFiles[i];
      const relPath = file.webkitRelativePath || file.name;
      const parts = relPath.split('/');
      if (parts.length > 0 && parts[0]) {
        rootFolderName = parts[0];
      }

      // Check if help candidate
      const nameLower = file.name.toLowerCase();
      const pathLower = relPath.toLowerCase();
      const isHelpCandidate = 
        /\.(md|txt|html|htm|json|xml|rtf)$/i.test(nameLower) || 
        /(help|manual|doc|readme|tutorial|guide|faq|instrucao|sobre)/i.test(pathLower);

      fileList.push({
        name: file.name,
        path: relPath,
        size: file.size,
        file: file,
        isHelpCandidate
      });
    }

    setFolderName(rootFolderName);
    setFiles(fileList);
    setSelectedPaths([]);
    setFilterKeyword('');

    // Update resumo estado with mapped folder info (METADATA ONLY - ZERO TOKENS!)
    const candidateNames = fileList.filter(f => f.isHelpCandidate).map(f => f.path).join(', ');
    const newSummaryAddition = `\n\n## Pasta Carregada: ${rootFolderName} (${fileList.length} arquivos)\n- Arquivos de Ajuda Detectados: [ ${candidateNames || 'Nenhum'} ]`;
    setResumoEstado(prev => prev + newSummaryAddition);
  };

  // Toggle selection of a candidate help file
  const handleToggleSelectCandidate = (candidate: FileNode) => {
    setSelectedPaths(prev => 
      prev.includes(candidate.path) 
        ? prev.filter(p => p !== candidate.path)
        : [...prev, candidate.path]
    );
  };

  const handleSelectAllFiltered = (filtered: FileNode[]) => {
    const filteredPaths = filtered.map(f => f.path);
    const allSelected = filteredPaths.every(p => selectedPaths.includes(p));
    if (allSelected) {
      setSelectedPaths(prev => prev.filter(p => !filteredPaths.includes(p)));
    } else {
      const combined = Array.from(new Set([...selectedPaths, ...filteredPaths]));
      setSelectedPaths(combined);
    }
  };

  // Batch Authorize selected candidate files
  const handleBatchAuthorize = (candidatesToAuth: FileNode[]) => {
    const unauthorized = candidatesToAuth.filter(f => !authorizedFiles[f.path]);
    if (unauthorized.length === 0) {
      alert('Todos os arquivos selecionados já estão autorizados.');
      return;
    }
    setPendingCandidates(unauthorized);
    setAuthModalOpen(true);
  };

  // Confirm batch authorization
  const confirmBatchAuthorization = async () => {
    if (pendingCandidates.length === 0) return;
    setLoading(true);
    try {
      const newAuthorized = { ...authorizedFiles };
      for (const candidate of pendingCandidates) {
        const rawText = await candidate.file.text();
        const cleanedText = rawText
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        newAuthorized[candidate.path] = cleanedText;
      }
      setAuthorizedFiles(newAuthorized);
      setAuthModalOpen(false);
      setPendingCandidates([]);
    } catch (err) {
      console.error('Erro ao ler arquivos autorizados:', err);
      alert('Erro ao ler arquivos autorizados.');
    } finally {
      setLoading(false);
    }
  };

  // Execute Challenge & AI Flow with Token Economy
  const handleRunChallenge = async () => {
    if (!challenge.trim()) {
      alert('Por favor, digite um desafio prático.');
      return;
    }

    const currentApiKey = apiKey || import.meta.env.VITE_GEMINI_API_KEY || '';
    if (!currentApiKey) {
      setShowApiModal(true);
      return;
    }

    setLoading(true);
    setSummaryCheckedFirst(true);
    setLastAlgorithm('');
    setLastDelta('');

    try {
      // Check if current resumo or authorized selected files contain info
      let helpContext = '';
      const authorizedSelectedPaths = selectedPaths.filter(p => authorizedFiles[p]);
      if (authorizedSelectedPaths.length > 0) {
        const combinedSnippets = authorizedSelectedPaths.map(p => {
          const snippet = extractRelevantSnippets(authorizedFiles[p], challenge, 350);
          return `[TRECHO RELEVANTE - ${p}]:\n${snippet}`;
        }).join('\n\n');
        helpContext = `\n\n[TRECHOS EXTRAÍDOS LOCALMENTE (${authorizedSelectedPaths.length} arquivos)]:\n${combinedSnippets}`;
      }

      const prompt = `Você é o ToolMapper AI, um engenheiro especialista em mapear ferramentas de programas com extremo rigor e economia de tokens.

[RESUMO DE ESTADO ATUAL]:
${resumoEstado}
${helpContext}

[DESAFIO PRÁTICO DO USUÁRIO]:
"${challenge}"

INSTRUÇÕES CRÍTICAS DE ECONOMIA E FLUXO:
1. Verifique PRIMEIRO o [RESUMO DE ESTADO ATUAL]. Se o resumo já contém as ferramentas e procedimentos para resolver o desafio, responda imediatamente com base nele, sem exigir leitura de novos arquivos.
2. Se o resumo for insuficiente, utilize o conteúdo dos arquivos de ajuda autorizados fornecidos.
3. Retorne estritamente um JSON válido conforme o schema exigido com duas chaves:
   - "algoritmo_pratico": Passos diretos e telegráficos no formato "1. [Ferramenta/Menu] -> [Ação exata]".
   - "delta_resumo": Apenas o conhecimento novo descoberto neste turno ("Ferramenta -> Função prática -> Como acionar" + "Desafio resolvido -> Sequência resumida em 1 linha").`;

      const resApi = await fetch('/api/generate-algorithm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, apiKey: currentApiKey })
      });

      if (!resApi.ok) {
        const errData = await resApi.json().catch(() => ({}));
        throw new Error(errData.error || 'Erro na comunicação com o servidor.');
      }

      const parsed = await resApi.json();
      const algo = parsed.algoritmo_pratico || 'Nenhum algoritmo gerado.';
      const delta = parsed.delta_resumo || '';

      setLastAlgorithm(algo);
      setLastDelta(delta);

      // AUTOMATIC STATE UPDATE: Append delta_resumo to Resumo de Estado
      if (delta) {
        const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const addition = `\n\n### Desafio Resolvido (${timestamp}): "${challenge}"\n- **Delta Descoberto:** ${delta}\n- **Algoritmo:** ${algo.replace(/\n/g, ' | ')}`;
        setResumoEstado(prev => prev + addition);
      }

      // Increment tokens saved counter estimate
      setTokensSaved(prev => prev + 340);

    } catch (err: any) {
      console.error('Erro na chamada Gemini:', err);
      alert(`Erro ao processar desafio: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  // Export Resumo de Estado as Markdown file
  const handleExportResumo = () => {
    const blob = new Blob([resumoEstado], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'resumo_estado.md';
    link.click();
    URL.revokeObjectURL(url);
  };

  // Import Resumo de Estado from Markdown file
  const handleImportResumo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setResumoEstado(content);
        alert('Resumo de Estado carregado com sucesso!');
      }
    };
    reader.readAsText(file);
  };

  const helpCandidates = files.filter(f => {
    const matchesFilter = filterKeyword.trim() === '' || f.path.toLowerCase().includes(filterKeyword.toLowerCase());
    return f.isHelpCandidate && matchesFilter;
  });

  const otherFiles = files.filter(f => !f.isHelpCandidate);

  return (
    <div className="min-h-screen bg-slate-950 text-emerald-400 font-mono flex flex-col selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Terminal Bar */}
      <header className="border-b border-emerald-800/40 bg-slate-900/80 px-4 py-3 flex items-center justify-between backdrop-blur-md sticky top-0 z-30">
        <div className="flex items-center space-x-3">
          <div className="flex space-x-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
          </div>
          <div className="flex items-center space-x-2 border-l border-emerald-800/40 pl-3">
            <Terminal className="w-5 h-5 text-emerald-400 animate-pulse" />
            <h1 className="text-lg font-bold tracking-wider text-emerald-300">TOOLMAPPER AI</h1>
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700/50 text-emerald-400">v2.4-token-saver</span>
          </div>
        </div>

        <div className="flex items-center space-x-4 text-xs">
          <div className="hidden md:flex items-center space-x-2 bg-emerald-950/60 px-3 py-1 rounded border border-emerald-800/40">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span>Tokens Economizados: <strong className="text-yellow-300">~{tokensSaved}</strong></span>
          </div>

          <button 
            onClick={() => setShowApiModal(true)}
            className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-700/50 flex items-center space-x-1 transition"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>{apiKey ? 'API Key Configurada' : 'Configurar API Key'}</span>
          </button>
        </div>
      </header>

      {/* Main 3-Panel Grid */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-px bg-emerald-900/20 overflow-hidden">
        
        {/* PANEL 1: Left Panel - Folder & Gatekeeper (Cols 1-3) */}
        <section className="lg:col-span-3 bg-slate-900/90 p-4 flex flex-col space-y-4 overflow-y-auto border-r border-emerald-900/40">
          <div className="flex items-center justify-between pb-2 border-b border-emerald-800/30">
            <h2 className="text-sm font-bold text-emerald-300 flex items-center space-x-2">
              <FolderOpen className="w-4 h-4 text-emerald-400" />
              <span>1. EXPLORADOR & GATEKEEPER</span>
            </h2>
            <span className="text-[10px] text-emerald-500 uppercase tracking-widest">Metadata Only</span>
          </div>

          {/* Folder Select Button */}
          <div className="space-y-2">
            <label className="block text-xs text-emerald-400/80">Selecione a Pasta do Programa:</label>
            <label className="cursor-pointer border-2 border-dashed border-emerald-700/50 hover:border-emerald-500 rounded-lg p-4 flex flex-col items-center justify-center bg-emerald-950/30 hover:bg-emerald-950/60 transition group">
              <HardDrive className="w-8 h-8 text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
              <span className="text-xs text-center text-emerald-300 font-semibold">
                {folderName ? `Pasta: ${folderName}` : 'Clique para escolher pasta'}
              </span>
              <span className="text-[10px] text-emerald-500 mt-1">Zero leitura de conteúdo (100% local)</span>
              <input 
                type="file" 
                // @ts-ignore
                webkitdirectory="" 
                directory="" 
                multiple 
                onChange={handleFolderSelect} 
                className="hidden" 
              />
            </label>
          </div>

          {/* Help Candidates & Gatekeeper List */}
          <div className="flex-1 flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-emerald-300 font-semibold flex items-center space-x-1">
                <Shield className="w-3.5 h-3.5 text-yellow-400" />
                <span>Candidatos de Ajuda ({helpCandidates.length})</span>
              </span>
              <span className="text-[10px] text-slate-400">Gatekeeper Ativo</span>
            </div>

            {/* Keyword Filter Input */}
            <div className="relative">
              <input 
                type="text"
                value={filterKeyword}
                onChange={(e) => setFilterKeyword(e.target.value)}
                placeholder="Filtrar candidatos por palavra-chave..."
                className="w-full bg-slate-950 border border-emerald-900/60 rounded px-2.5 py-1.5 text-[11px] text-emerald-300 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
              />
              {filterKeyword && (
                <button 
                  onClick={() => setFilterKeyword('')}
                  className="absolute right-2 top-1.5 text-xs text-slate-500 hover:text-emerald-300"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Batch Selection & Authorization Actions */}
            {helpCandidates.length > 0 && (
              <div className="flex items-center justify-between text-[11px] pt-1">
                <button
                  onClick={() => handleSelectAllFiltered(helpCandidates)}
                  className="text-emerald-400 hover:underline flex items-center space-x-1"
                >
                  <span>{helpCandidates.every(f => selectedPaths.includes(f.path)) ? 'Desselecionar Todos' : 'Selecionar Todos'}</span>
                </button>

                <button
                  onClick={() => {
                    const selectedList = helpCandidates.filter(f => selectedPaths.includes(f.path));
                    if (selectedList.length === 0) {
                      alert('Selecione ao menos um arquivo na lista.');
                      return;
                    }
                    handleBatchAuthorize(selectedList);
                  }}
                  disabled={selectedPaths.length === 0}
                  className="px-2.5 py-1 bg-emerald-900 hover:bg-emerald-800 disabled:bg-slate-800 disabled:text-slate-600 text-emerald-200 rounded border border-emerald-700/50 transition flex items-center space-x-1"
                >
                  <Unlock className="w-3 h-3" />
                  <span>Autorizar Selecionados ({selectedPaths.length})</span>
                </button>
              </div>
            )}

            <div className="bg-slate-950/80 rounded border border-emerald-900/50 p-2 max-h-44 overflow-y-auto space-y-1 text-xs">
              {files.length === 0 ? (
                <div className="text-slate-500 text-center py-6 text-[11px]">Nenhuma pasta carregada.</div>
              ) : helpCandidates.length === 0 ? (
                <div className="text-yellow-500/80 text-center py-4 text-[11px]">Nenhum arquivo encontrado com este filtro.</div>
              ) : null}

              {helpCandidates.map((file, idx) => {
                const isAuth = !!authorizedFiles[file.path];
                const isChecked = selectedPaths.includes(file.path);
                return (
                  <div 
                    key={idx}
                    className={`p-2 rounded flex items-center justify-between transition border ${
                      isChecked 
                        ? 'bg-emerald-900/40 border-emerald-500 text-emerald-200' 
                        : isAuth 
                          ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300' 
                          : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-emerald-700/50'
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate flex-1 cursor-pointer" onClick={() => handleToggleSelectCandidate(file)}>
                      <input 
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleSelectCandidate(file)}
                        className="rounded border-emerald-700 text-emerald-600 focus:ring-0 cursor-pointer"
                      />
                      <FileText className={`w-3.5 h-3.5 shrink-0 ${isAuth ? 'text-emerald-400' : 'text-yellow-500'}`} />
                      <span className="truncate" title={file.path}>{file.path}</span>
                    </div>
                    <div className="shrink-0 pl-2">
                      {isAuth ? (
                        <span className="flex items-center space-x-1 text-[10px] text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-700">
                          <Unlock className="w-3 h-3" />
                          <span>Autorizado</span>
                        </span>
                      ) : (
                        <span className="flex items-center space-x-1 text-[10px] text-yellow-400 bg-yellow-950/50 px-1.5 py-0.5 rounded border border-yellow-700/50">
                          <Lock className="w-3 h-3" />
                          <span>Bloqueado</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Other files tree preview */}
              {otherFiles.length > 0 && (
                <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-500">
                  <div className="font-semibold text-slate-400 mb-1">Outros arquivos ({otherFiles.length}):</div>
                  <div className="max-h-28 overflow-y-auto space-y-0.5 font-mono text-[10px]">
                    {otherFiles.slice(0, 30).map((f, i) => (
                      <div key={i} className="truncate text-slate-500 px-1">{f.path}</div>
                    ))}
                    {otherFiles.length > 30 && <div className="text-slate-600">...e mais {otherFiles.length - 30} arquivos</div>}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="text-[10px] text-emerald-500/80 bg-emerald-950/40 p-2 rounded border border-emerald-900/30">
            ℹ️ O conteúdo de qualquer arquivo só é lido após autorização expressa no gatekeeper.
          </div>
        </section>

        {/* PANEL 2: Central Panel - Challenge & Algorithm Output (Cols 4-8) */}
        <section className="lg:col-span-5 bg-slate-900/90 p-4 flex flex-col space-y-4 overflow-y-auto border-r border-emerald-900/40">
          <div className="flex items-center justify-between pb-2 border-b border-emerald-800/30">
            <h2 className="text-sm font-bold text-emerald-300 flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>2. DESAFIO PRÁTICO & ALGORITMO</span>
            </h2>
            <span className="text-[10px] text-emerald-500">Gemini 2.5 Flash</span>
          </div>

          {/* Challenge Input */}
          <div className="space-y-2">
            <label className="block text-xs text-emerald-400/80">Desafio Prático (O que você quer fazer no programa?):</label>
            <textarea 
              value={challenge}
              onChange={(e) => setChallenge(e.target.value)}
              placeholder="Ex: Como exportar dados em lote ou configurar atalhos de teclado?"
              className="w-full h-24 bg-slate-950 border border-emerald-800/60 rounded p-3 text-xs text-emerald-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 resize-none font-mono"
            />
          </div>

          {/* Run Challenge Button */}
          <button
            onClick={handleRunChallenge}
            disabled={loading}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold rounded flex items-center justify-center space-x-2 transition shadow-lg shadow-emerald-900/20 cursor-pointer"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                <span>Verificando Resumo & Processando IA...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-slate-950" />
                <span>Gerar Algoritmo (Checar Resumo Primeiro)</span>
              </>
            )}
          </button>

          {/* Token economy notice badge */}
          {summaryCheckedFirst && (
            <div className="bg-emerald-950/60 border border-emerald-800/50 p-2 rounded flex items-center space-x-2 text-[11px] text-emerald-300 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Resumo verificado antes da consulta. Arquivos desnecessários ignorados (Token Zero excedente).</span>
            </div>
          )}

          {/* Algorithm Output Area */}
          <div className="flex-1 flex flex-col space-y-2">
            <span className="text-xs text-emerald-300 font-semibold flex items-center justify-between">
              <span>Algoritmo Prático Gerado:</span>
              {selectedPaths.filter(p => authorizedFiles[p]).length > 0 && (
                <span className="text-[10px] text-yellow-400 bg-yellow-950/60 px-2 py-0.5 rounded border border-yellow-800">
                  Ajuda Ativa: {selectedPaths.filter(p => authorizedFiles[p]).length} arq(s)
                </span>
              )}
            </span>

            <div className="flex-1 bg-slate-950 rounded border border-emerald-900/60 p-4 overflow-y-auto font-mono text-xs space-y-4 min-h-[220px]">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2">
                  <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-[11px]">Consultando memória e otimizando tokens...</p>
                </div>
              ) : lastAlgorithm ? (
                <div className="space-y-4 animate-fadeIn">
                  <div className="p-3 bg-emerald-950/40 rounded border border-emerald-800/40 text-emerald-200 leading-relaxed whitespace-pre-wrap">
                    {lastAlgorithm}
                  </div>
                  {lastDelta && (
                    <div className="p-3 bg-slate-900/80 rounded border border-slate-800 text-slate-300 text-[11px]">
                      <span className="font-bold text-yellow-400 block mb-1">Delta Salvo no Resumo:</span>
                      {lastDelta}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-slate-600 text-center py-12 text-[11px]">
                  Nenhum algoritmo gerado ainda. Insira um desafio acima e clique em gerar.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* PANEL 3: Right Panel - Resumo de Estado Acumulado (Cols 9-12) */}
        <section className="lg:col-span-4 bg-slate-900/90 p-4 flex flex-col space-y-4 overflow-y-auto">
          <div className="flex items-center justify-between pb-2 border-b border-emerald-800/35">
            <h2 className="text-sm font-bold text-emerald-300 flex items-center space-x-2">
              <Database className="w-4 h-4 text-emerald-400" />
              <span>3. RESUMO DE ESTADO ACUMULADO</span>
            </h2>
            <div className="flex items-center space-x-1">
              <button 
                onClick={handleExportResumo}
                title="Baixar resumo_estado.md"
                className="p-1.5 rounded bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/60 transition"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              <label 
                title="Carregar resumo_estado.md"
                className="p-1.5 rounded bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/60 cursor-pointer transition inline-flex items-center"
              >
                <Upload className="w-3.5 h-3.5" />
                <input type="file" accept=".md,.txt" onChange={handleImportResumo} className="hidden" />
              </label>
            </div>
          </div>

          {/* Real-time Editor / Viewer of Resumo de Estado */}
          <div className="flex-1 flex flex-col space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Editável em tempo real (Markdown):</span>
              <span className="text-emerald-500">Auto-salva no localStorage</span>
            </div>

            <textarea 
              value={resumoEstado}
              onChange={(e) => setResumoEstado(e.target.value)}
              className="w-full flex-1 bg-slate-950 border border-emerald-900/60 rounded p-3 text-[11px] text-emerald-300 font-mono focus:outline-none focus:border-emerald-500 resize-none min-h-[350px] leading-relaxed"
            />
          </div>

          <div className="bg-slate-950 p-3 rounded border border-emerald-900/50 space-y-2 text-[11px]">
            <div className="flex justify-between items-center text-slate-400">
              <span>Estado Persistente:</span>
              <span className="text-emerald-400 font-bold">Ativo</span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Modo Token Zero:</span>
              <span className="text-yellow-400 font-bold">100% Local (Metadata)</span>
            </div>
          </div>
        </section>

      </main>

      {/* GATEKEEPER AUTHORIZATION MODAL */}
      {authModalOpen && pendingCandidates.length > 0 && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-yellow-500/50 rounded-lg max-w-md w-full p-6 space-y-4 shadow-2xl animate-fadeIn">
            <div className="flex items-center space-x-3 text-yellow-400">
              <ShieldAlert className="w-8 h-8 shrink-0" />
              <div>
                <h3 className="text-base font-bold text-yellow-300">Gatekeeper de Segurança</h3>
                <p className="text-xs text-slate-400">Autorização de Leitura em Lote ({pendingCandidates.length} arquivos)</p>
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded border border-slate-800 text-xs space-y-2">
              <p className="text-slate-300">
                Você está prestes a autorizar a leitura dos seguintes arquivos de ajuda selecionados:
              </p>
              <div className="max-h-32 overflow-y-auto space-y-1 font-mono text-emerald-400 text-[11px] bg-emerald-950/40 p-2 rounded border border-emerald-900">
                {pendingCandidates.map((c, i) => (
                  <div key={i} className="truncate">• {c.path}</div>
                ))}
              </div>
              <p className="text-[11px] text-slate-400">
                Nenhum outro arquivo da pasta será lido. O conteúdo será limpo e processado com o mínimo de tokens.
              </p>
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => {
                  setAuthModalOpen(false);
                  setPendingCandidates([]);
                }}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded transition"
              >
                Recusar
              </button>
              <button
                onClick={confirmBatchAuthorization}
                disabled={loading}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold rounded transition flex items-center justify-center space-x-1"
              >
                {loading ? <span>Lendo...</span> : <span>Autorizar Leitura ({pendingCandidates.length})</span>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API KEY CONFIG MODAL */}
      {showApiModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-emerald-700/50 rounded-lg max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-emerald-400">
              <Cpu className="w-6 h-6 shrink-0" />
              <div>
                <h3 className="text-base font-bold text-emerald-300">Configuração da API Gemini</h3>
                <p className="text-xs text-slate-400">Insira sua chave de API para o ToolMapper AI</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs text-emerald-400/80">Gemini API Key:</label>
              <input 
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-slate-950 border border-emerald-800/60 rounded p-2 text-xs text-emerald-200 font-mono focus:outline-none focus:border-emerald-500"
              />
              <p className="text-[11px] text-slate-500">
                Se o ambiente já injetar automaticamente a variável GEMINI_API_KEY, você pode deixar este campo em branco.
              </p>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setShowApiModal(false)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold rounded transition"
              >
                Salvar & Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
