import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Network,
  Dna,
  Layers,
  Tag,
  Code,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  CheckCircle2,
  XCircle,
  Check,
  Eye,
  Activity,
  Filter,
  Move
} from 'lucide-react';

export default function GraphVisualization({ phenotypes = [], ranking = [] }) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);

  // Zoom & Pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Selection & UI state
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [showQuery, setShowQuery] = useState(false);
  const [showAbsent, setShowAbsent] = useState(false);
  const [candidateCount, setCandidateCount] = useState(5); // Show up to 5 candidates
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Active phenotypes list
  const activePhenotypes = useMemo(() => {
    if (showAbsent) return phenotypes;
    return (phenotypes || []).filter(p => !p.negated);
  }, [phenotypes, showAbsent]);

  // Selected candidate diseases
  const topDiseases = useMemo(() => {
    return (ranking || []).slice(0, candidateCount);
  }, [ranking, candidateCount]);

  // Collect unique genes from candidates
  const geneList = useMemo(() => {
    const set = new Set();
    topDiseases.forEach(d => {
      (d.genes || []).forEach(g => set.add(g));
    });
    return Array.from(set);
  }, [topDiseases]);

  // Calculate layout coordinates for 3 semantic tiers
  const layout = useMemo(() => {
    const rowCount = Math.max(activePhenotypes.length, topDiseases.length, geneList.length, 3);
    const rowHeight = 76;
    const width = 1050;
    const height = Math.max(480, rowCount * rowHeight + 100);

    const phenoX = 180;
    const diseaseX = 530;
    const geneX = 890;

    const nodes = [];
    const links = [];

    // 1. Phenotype nodes (Left column)
    const phenoSpacing = (height - 120) / Math.max(1, activePhenotypes.length);
    activePhenotypes.forEach((p, idx) => {
      const y = 60 + idx * phenoSpacing + phenoSpacing / 2;
      const node = {
        id: p.hpo_id,
        label: p.hpo_label || p.text,
        type: 'phenotype',
        system: p.system || 'other',
        onset: p.onset,
        negated: p.negated,
        x: phenoX,
        y: y,
        data: p,
      };
      nodes.push(node);
    });

    // 2. Disease nodes (Center column)
    const diseaseSpacing = (height - 120) / Math.max(1, topDiseases.length);
    topDiseases.forEach((d, idx) => {
      const y = 60 + idx * diseaseSpacing + diseaseSpacing / 2;
      const node = {
        id: d.id,
        label: d.name,
        type: 'disease',
        rank: idx + 1,
        final_score: d.final_score,
        graph_norm: d.graph_norm,
        panel_consensus: d.panel_consensus,
        genes: d.genes || [],
        matched_hpo: d.matched_hpo || [],
        x: diseaseX,
        y: y,
        data: d,
      };
      nodes.push(node);

      // Links from matched phenotypes to this disease
      (d.matched_hpo || []).forEach(hpoId => {
        const phenoNode = nodes.find(n => n.id === hpoId && n.type === 'phenotype');
        if (phenoNode) {
          links.push({
            id: `${hpoId}->${d.id}`,
            source: phenoNode,
            target: node,
            type: 'phenotype-disease',
          });
        }
      });

      // Links from this disease to genes
      (d.genes || []).forEach(geneSymbol => {
        links.push({
          id: `${d.id}->${geneSymbol}`,
          sourceId: d.id,
          targetSymbol: geneSymbol,
          type: 'disease-gene',
        });
      });
    });

    // 3. Gene nodes (Right column)
    const geneSpacing = (height - 120) / Math.max(1, geneList.length);
    geneList.forEach((g, idx) => {
      const y = 60 + idx * geneSpacing + geneSpacing / 2;
      const node = {
        id: `gene-${g}`,
        symbol: g,
        label: g,
        type: 'gene',
        x: geneX,
        y: y,
      };
      nodes.push(node);
    });

    // Fixup disease-gene link references
    const resolvedLinks = links.map(link => {
      if (link.type === 'disease-gene') {
        const source = nodes.find(n => n.id === link.sourceId);
        const target = nodes.find(n => n.type === 'gene' && n.symbol === link.targetSymbol);
        return { ...link, source, target };
      }
      return link;
    }).filter(l => l.source && l.target);

    return { width, height, nodes, links: resolvedLinks };
  }, [activePhenotypes, topDiseases, geneList]);

  // Zoom control handlers (Manual buttons only)
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.15, 2.5));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.15, 0.4));
  const handleResetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Mouse drag to pan
  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // Only primary button
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Active highlighted node
  const activeNode = selectedNode || hoveredNode;

  const isLinkHighlighted = (link) => {
    if (!activeNode) return false;
    if (activeNode.id === link.source.id || activeNode.id === link.target.id) return true;
    if (activeNode.type === 'disease') {
      return link.source.id === activeNode.id || link.target.id === activeNode.id;
    }
    return false;
  };

  if (!phenotypes?.length || !ranking?.length) {
    return (
      <div className="section-card animate-fade-in">
        <div className="section-header">
          <div className="section-title">
            <div className="section-title-icon">
              <Network size={18} className="text-primary" />
            </div>
            <span>Knowledge Graph <em>Visualization</em></span>
          </div>
        </div>
        <div className="section-body">
          <div className="empty-state" style={{ padding: 'var(--space-xl)' }}>
            <Network size={36} className="text-muted" style={{ margin: '0 auto 12px' }} />
            <div className="text-sm text-secondary">
              Graph visualization will appear once diagnosis candidates are generated.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`section-card animate-fade-in ${isFullscreen ? 'fullscreen-graph' : ''}`}
      style={{
        borderRadius: 'var(--radius-lg)',
        position: isFullscreen ? 'fixed' : 'relative',
        top: isFullscreen ? 0 : 'auto',
        left: isFullscreen ? 0 : 'auto',
        width: isFullscreen ? '100vw' : 'auto',
        height: isFullscreen ? '100vh' : 'auto',
        zIndex: isFullscreen ? 9999 : 1,
        background: '#ffffff'
      }}
    >
      {/* Header with Interactive Controls */}
      <div className="section-header" style={{ flexWrap: 'wrap', gap: 'var(--space-sm)', padding: '12px 18px' }}>
        <div className="section-title">
          <div className="section-title-icon">
            <Network size={18} className="text-primary" />
          </div>
          <span>Ontology &amp; Disease <em>Knowledge Graph</em></span>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-xs" style={{ flexWrap: 'wrap' }}>
          {/* Manual Zoom Controls Only (No scrollwheel) */}
          <div className="flex items-center gap-xs" style={{ background: 'rgba(240, 244, 255, 0.9)', padding: '3px 6px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <span className="text-xs text-muted" style={{ fontWeight: 600, marginRight: 2 }}>Zoom:</span>
            <button
              className="tab"
              onClick={handleZoomIn}
              title="Zoom In (+)"
              style={{ padding: '3px 8px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', background: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2, fontSize: '0.75rem', fontWeight: 600 }}
            >
              <ZoomIn size={13} />
              <span>+</span>
            </button>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0 6px', minWidth: '38px', textAlign: 'center', color: 'var(--color-primary-dark)', fontFamily: 'var(--font-mono)' }}>
              {Math.round(zoom * 100)}%
            </span>
            <button
              className="tab"
              onClick={handleZoomOut}
              title="Zoom Out (-)"
              style={{ padding: '3px 8px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', background: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2, fontSize: '0.75rem', fontWeight: 600 }}
            >
              <ZoomOut size={13} />
              <span>-</span>
            </button>
            <button
              className="tab"
              onClick={handleResetZoom}
              title="Reset Zoom to 100%"
              style={{ padding: '3px 8px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', background: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}
            >
              <RotateCcw size={12} />
              <span>Reset</span>
            </button>
          </div>

          {/* Candidates Count Selector */}
          <div className="flex items-center gap-xs" style={{ marginLeft: 6 }}>
            <span className="text-xs text-muted">Show:</span>
            <button
              className={`badge ${candidateCount === 3 ? 'badge-primary' : 'badge-neutral'}`}
              onClick={() => setCandidateCount(3)}
              style={{ cursor: 'pointer', border: 'none', padding: '2px 7px' }}
            >
              Top 3
            </button>
            <button
              className={`badge ${candidateCount === 5 ? 'badge-primary' : 'badge-neutral'}`}
              onClick={() => setCandidateCount(5)}
              style={{ cursor: 'pointer', border: 'none', padding: '2px 7px' }}
            >
              Top 5
            </button>
          </div>

          {/* Toggle Ruled Out */}
          {phenotypes.some(p => p.negated) && (
            <button
              className={`badge ${showAbsent ? 'badge-red' : 'badge-neutral'} flex items-center gap-xs`}
              onClick={() => setShowAbsent(!showAbsent)}
              style={{ cursor: 'pointer', border: 'none', padding: '2px 8px' }}
            >
              <Filter size={11} />
              <span>{showAbsent ? 'Showing Ruled Out' : 'Hide Ruled Out'}</span>
            </button>
          )}

          {/* Cypher Query Toggle */}
          <button
            className={`badge ${showQuery ? 'badge-primary' : 'badge-neutral'} flex items-center gap-xs`}
            onClick={() => setShowQuery(!showQuery)}
            style={{ cursor: 'pointer', border: 'none', padding: '2px 8px' }}
          >
            <Code size={11} />
            <span>Cypher</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            className="badge badge-neutral flex items-center gap-xs"
            onClick={() => setIsFullscreen(!isFullscreen)}
            style={{ cursor: 'pointer', border: 'none', padding: '2px 8px' }}
            title={isFullscreen ? 'Exit Fullscreen' : 'Expand Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        </div>
      </div>

      {/* Optional Cypher Graph Traversal Box */}
      {showQuery && (
        <div style={{ padding: '10px 18px', background: 'rgba(240, 245, 255, 0.8)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="text-xs font-mono" style={{ color: 'var(--color-primary-dark)', lineHeight: 1.5 }}>
            <span style={{ color: '#0d9488', fontWeight: 700 }}>MATCH</span> (p:Phenotype)-[:IS_A*0..]-&gt;(a:Phenotype)&lt;-[:HAS_PHENOTYPE]-(d:Disease)-[:CAUSED_BY]-&gt;(g:Gene)<br />
            <span style={{ color: '#0d9488', fontWeight: 700 }}>WHERE</span> p.id IN $patient_hpo_ids<br />
            <span style={{ color: '#0d9488', fontWeight: 700 }}>RETURN</span> d.id, d.name, sum(a.ic) AS ic_score, collect(DISTINCT g.symbol) AS genes
          </div>
        </div>
      )}

      {/* Interactive Graph Canvas Area */}
      <div
        className="section-body"
        style={{
          padding: '12px 18px 16px',
          position: 'relative',
          height: isFullscreen ? 'calc(100vh - 120px)' : 'auto'
        }}
      >
        {/* Navigation Hint */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div className="text-xs text-muted flex items-center gap-xs">
            <Move size={12} />
            <span>Click &amp; drag to pan canvas &bull; Use zoom buttons (+) and (-) to adjust magnification</span>
          </div>
          <span className="badge badge-primary-subtle" style={{ fontSize: '0.65rem' }}>
            {layout.nodes.length} Nodes &bull; {layout.links.length} Relations
          </span>
        </div>

        {/* Viewport Frame with Mouse Drag */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            background: 'linear-gradient(180deg, #fbfdff 0%, #f4f7fc 100%)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            overflow: 'hidden',
            cursor: isDragging ? 'grabbing' : 'grab',
            position: 'relative',
            height: isFullscreen ? '100%' : Math.min(layout.height + 40, 560),
            userSelect: 'none'
          }}
        >
          {/* Column Category Labels (Fixed over the canvas) */}
          <div
            style={{
              position: 'absolute',
              top: 8,
              left: 0,
              right: 0,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              textAlign: 'center',
              pointerEvents: 'none',
              zIndex: 10,
              padding: '0 40px'
            }}
          >
            <div className="text-xs font-semibold text-muted uppercase tracking-wider flex items-center justify-center gap-xs">
              <Tag size={12} style={{ color: '#0d9488' }} /> Patient Phenotypes (HPO)
            </div>
            <div className="text-xs font-semibold text-muted uppercase tracking-wider flex items-center justify-center gap-xs">
              <Layers size={12} style={{ color: '#4F6EF7' }} /> Candidate Diseases (OMIM/ORPHA)
            </div>
            <div className="text-xs font-semibold text-muted uppercase tracking-wider flex items-center justify-center gap-xs">
              <Dna size={12} style={{ color: '#8b5cf6' }} /> Causative Genes
            </div>
          </div>

          <svg
            ref={svgRef}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            width="100%"
            height="100%"
            style={{ display: 'block' }}
          >
            <defs>
              <filter id="cardGlow" x="-15%" y="-15%" width="130%" height="130%">
                <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000000" floodOpacity="0.08" />
              </filter>
              <filter id="activeGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#4F6EF7" floodOpacity="0.3" />
              </filter>
            </defs>

            {/* Transform Group for Pan & Zoom */}
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              {/* Connector Bezier Curves */}
              {layout.links.map(link => {
                const highlighted = isLinkHighlighted(link);
                const isGeneLink = link.type === 'disease-gene';

                const x1 = link.source.x + (link.source.type === 'phenotype' ? 95 : 105);
                const y1 = link.source.y;
                const x2 = link.target.x - (link.target.type === 'gene' ? 45 : 105);
                const y2 = link.target.y;
                const dx = (x2 - x1) * 0.5;

                const pathD = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

                return (
                  <path
                    key={link.id}
                    d={pathD}
                    fill="none"
                    stroke={
                      highlighted
                        ? isGeneLink ? '#8b5cf6' : '#4F6EF7'
                        : isGeneLink ? 'rgba(139, 92, 246, 0.28)' : 'rgba(79, 110, 247, 0.22)'
                    }
                    strokeWidth={highlighted ? 3 : 1.6}
                    strokeDasharray={isGeneLink ? '4 4' : undefined}
                    style={{ transition: 'stroke 0.2s, stroke-width 0.2s' }}
                  />
                );
              })}

              {/* Node Cards */}
              {layout.nodes.map(node => {
                const isSelected = selectedNode?.id === node.id;
                const isHovered = hoveredNode?.id === node.id;
                const isFocused = isSelected || isHovered;

                // 1. Phenotype Node
                if (node.type === 'phenotype') {
                  const isNeg = node.negated;
                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x}, ${node.y})`}
                      style={{ cursor: 'pointer' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNode(node === selectedNode ? null : node);
                      }}
                      onMouseEnter={() => setHoveredNode(node)}
                      onMouseLeave={() => setHoveredNode(null)}
                      filter={isFocused ? 'url(#activeGlow)' : 'url(#cardGlow)'}
                    >
                      <rect
                        x="-90"
                        y="-22"
                        width="185"
                        height="44"
                        rx="8"
                        fill={isFocused ? '#f0fdfa' : isNeg ? 'rgba(254, 242, 242, 0.95)' : '#ffffff'}
                        stroke={isFocused ? '#0d9488' : isNeg ? '#fca5a5' : '#e2e8f0'}
                        strokeWidth={isFocused ? 2 : 1}
                      />
                      <circle cx="-74" cy="0" r="4.5" fill={isNeg ? '#dc2626' : '#0d9488'} />
                      <text
                        x="-60"
                        y="-4"
                        fontSize="11"
                        fontWeight="600"
                        fill={isNeg ? '#64748b' : '#0f172a'}
                        textDecoration={isNeg ? 'line-through' : 'none'}
                      >
                        {node.label.length > 19 ? node.label.slice(0, 17) + '…' : node.label}
                      </text>
                      <text x="-60" y="11" fontSize="9" fontFamily="var(--font-mono)" fill={isNeg ? '#dc2626' : '#0d9488'}>
                        {isNeg ? 'RULED OUT' : node.id}
                      </text>
                    </g>
                  );
                }

                // 2. Candidate Disease Node
                if (node.type === 'disease') {
                  const isTop = node.rank === 1;
                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x}, ${node.y})`}
                      style={{ cursor: 'pointer' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNode(node === selectedNode ? null : node);
                      }}
                      onMouseEnter={() => setHoveredNode(node)}
                      onMouseLeave={() => setHoveredNode(null)}
                      filter={isFocused ? 'url(#activeGlow)' : 'url(#cardGlow)'}
                    >
                      <rect
                        x="-105"
                        y="-26"
                        width="210"
                        height="52"
                        rx="10"
                        fill={isFocused ? '#eef2ff' : isTop ? '#ffffff' : '#ffffff'}
                        stroke={isFocused ? '#4F6EF7' : isTop ? '#4F6EF7' : '#e2e8f0'}
                        strokeWidth={isFocused || isTop ? 2 : 1}
                      />
                      <circle cx="-86" cy="0" r="11" fill={isTop ? '#4F6EF7' : 'rgba(79, 110, 247, 0.12)'} />
                      <text x="-86" y="4" textAnchor="middle" fontSize="10.5" fontWeight="800" fill={isTop ? '#ffffff' : '#4F6EF7'}>
                        #{node.rank}
                      </text>
                      <text x="-66" y="-7" fontSize="11" fontWeight="700" fill="#0f172a">
                        {node.label.length > 21 ? node.label.slice(0, 19) + '…' : node.label}
                      </text>
                      <text x="-66" y="9" fontSize="9.5" fontFamily="var(--font-mono)" fill="#64748b">
                        {node.id} &bull; Score: {(node.final_score || 0).toFixed(3)}
                      </text>
                    </g>
                  );
                }

                // 3. Causative Gene Node
                if (node.type === 'gene') {
                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x}, ${node.y})`}
                      style={{ cursor: 'pointer' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNode(node === selectedNode ? null : node);
                      }}
                      onMouseEnter={() => setHoveredNode(node)}
                      onMouseLeave={() => setHoveredNode(null)}
                      filter={isFocused ? 'url(#activeGlow)' : 'url(#cardGlow)'}
                    >
                      <rect
                        x="-42"
                        y="-16"
                        width="84"
                        height="32"
                        rx="16"
                        fill={isFocused ? '#f5f3ff' : '#ffffff'}
                        stroke={isFocused ? '#8b5cf6' : '#e2e8f0'}
                        strokeWidth={isFocused ? 2 : 1}
                      />
                      <text x="0" y="4.5" textAnchor="middle" fontSize="11" fontWeight="800" fill="#8b5cf6" fontFamily="var(--font-mono)">
                        {node.symbol}
                      </text>
                    </g>
                  );
                }

                return null;
              })}
            </g>
          </svg>
        </div>

        {/* Selected Node Details Drawer */}
        {selectedNode && (
          <div
            className="animate-fade-in"
            style={{
              marginTop: 'var(--space-md)',
              padding: '12px 16px',
              background: '#ffffff',
              borderRadius: 'var(--radius-md)',
              border: '1.5px solid var(--accent-primary-border)',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10
            }}
          >
            <div>
              <div className="flex items-center gap-xs" style={{ marginBottom: 3 }}>
                <span
                  className={`badge ${
                    selectedNode.type === 'phenotype' ? 'badge-teal' :
                    selectedNode.type === 'disease' ? 'badge-primary' : 'badge-purple'
                  }`}
                  style={{ textTransform: 'uppercase', fontSize: '0.65rem' }}
                >
                  {selectedNode.type}
                </span>
                <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                  {selectedNode.label}
                </span>
                <span className="font-mono text-muted text-xs">({selectedNode.id})</span>
              </div>
              <div className="text-xs text-secondary">
                {selectedNode.type === 'phenotype' && (
                  <span>
                    System: <strong>{selectedNode.system}</strong> {selectedNode.onset ? `• Onset: ${selectedNode.onset}` : ''}
                    {selectedNode.negated ? ' • Status: Ruled Out' : ' • Status: Present in Patient'}
                  </span>
                )}
                {selectedNode.type === 'disease' && (
                  <span>
                    Rank: <strong>#{selectedNode.rank}</strong> • Final Composite Score: <strong>{(selectedNode.final_score || 0).toFixed(3)}</strong> • Matched HPO Terms: <strong>{selectedNode.matched_hpo?.length || 0}</strong> • Causative Genes: <strong>{selectedNode.genes?.join(', ') || 'None'}</strong>
                  </span>
                )}
                {selectedNode.type === 'gene' && (
                  <span>
                    Causative Gene Symbol: <strong>{selectedNode.symbol}</strong>
                  </span>
                )}
              </div>
            </div>
            <button
              className="badge badge-neutral"
              onClick={() => setSelectedNode(null)}
              style={{ cursor: 'pointer', border: 'none', padding: '3px 10px' }}
            >
              Clear Inspector
            </button>
          </div>
        )}

        {/* Legend */}
        <div className="graph-legend" style={{ marginTop: 'var(--space-md)' }}>
          <div className="graph-legend-item">
            <div className="graph-legend-dot" style={{ background: '#0d9488' }} />
            <span>Patient Phenotypes (HPO)</span>
          </div>
          <div className="graph-legend-item">
            <div className="graph-legend-dot" style={{ background: '#4F6EF7' }} />
            <span>Candidate Diseases (OMIM/ORPHA)</span>
          </div>
          <div className="graph-legend-item">
            <div className="graph-legend-dot" style={{ background: '#8b5cf6' }} />
            <span>Causative Genes</span>
          </div>
        </div>
      </div>
    </div>
  );
}
