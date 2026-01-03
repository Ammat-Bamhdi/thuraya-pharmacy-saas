/**
 * @fileoverview Branch network visualization using D3.js force-directed graph
 * @author Thuraya Systems
 * @created 2026-01-03
 * @updated 2026-01-03
 */

import { Component, ElementRef, ViewChild, ViewEncapsulation, effect, input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '@shared/components/icons/icons.component';

declare var d3: any;

/**
 * @component BranchNetworkComponent
 * @description Interactive branch network visualization
 * 
 * @features
 * - Force-directed graph layout
 * - Interactive node dragging
 * - Branch hierarchy display
 * - Export/print functionality
 * - Responsive zoom and pan
 * 
 * @dependencies
 * - D3.js: Graph visualization
 * 
 * @example
 * <app-branch-network></app-branch-network>
 * 
 * @architecture
 * - OnPush change detection
 * - ViewEncapsulation.None for D3 styles
 * - Effect-based graph updates
 * 
 * @since 1.0.0
 */
@Component({
  selector: 'app-branch-network',
  standalone: true,
  imports: [CommonModule, IconComponent],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './branch-network.component.html',
  styles: [`
    .node foreignObject {
      overflow: visible;
    }
    .link {
      fill: none;
      stroke: #cbd5e1;
      stroke-width: 2px;
      transition: all 0.5s ease;
    }
    .node {
      cursor: default;
      transition: all 0.5s ease;
    }
    .toggle-btn {
        transition: all 0.2s;
        cursor: pointer;
    }
    .toggle-btn:hover {
        transform: scale(1.05);
        opacity: 0.9;
    }
    /* Ensure font availability in SVG foreignObject */
    .card-text {
        font-family: 'Inter', system-ui, sans-serif;
    }
  `]
})
export class BranchNetworkComponent {
  tenantName = input.required<string>();
  branches = input.required<{name: string, location: string}[]>();
  teamMembers = input<{name: string, role: string, branchIndex: number}[]>([]);
  isRtl = input<boolean>(false);
  translations = input<{
    hq: string,
    location: string,
    noManager: string,
    staff: string,
    branches: string
  }>({
    hq: 'HQ',
    location: 'Location',
    noManager: 'No manager',
    staff: 'Staff',
    branches: 'Branches'
  });

  @ViewChild('container', { static: true }) container!: ElementRef;
  @ViewChild('chart', { static: true }) chartContainer!: ElementRef;

  // Track expansion state: nodeId -> 'branches' | 'people' | null
  expansionState: Record<string, 'branches' | 'people' | null> = { 'root': 'branches' };
  
  constructor() {
    effect(() => {
      this.updateGraph();
    });
  }

  updateGraph() {
    if (!this.chartContainer) return;
    
    const element = this.chartContainer.nativeElement;
    const containerWidth = this.container.nativeElement.offsetWidth || 800;
    const t = this.translations();
    
    // Clear previous
    d3.select(element).selectAll('*').remove();

    const svg = d3.select(element)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('xmlns', 'http://www.w3.org/2000/svg');

    const g = svg.append('g');
    
    const zoom = d3.zoom()
      .scaleExtent([0.1, 2])
      .on('zoom', (event: any) => {
        g.attr('transform', event.transform);
      });
    svg.call(zoom);
    svg.call(zoom.transform, d3.zoomIdentity.translate(containerWidth / 2, 80).scale(0.8));

    // --- 1. Construct Data Model ---
    
    const hqPeople = [
        { name: 'You (Owner)', role: 'super_admin', type: 'person' }
    ];

    const branchesData = this.branches().map((b, i) => {
        const staff = this.teamMembers().filter((t: any) => t.branchIndex === i);
        const hasManager = staff.some((t: any) => t.role === 'branch_admin');
        
        return {
          id: `branch-${i}`,
          index: i,
          name: b.name || 'Unnamed Branch',
          location: b.location || 'Unknown Location',
          type: 'branch',
          staffCount: staff.length,
          warning: hasManager ? null : t.noManager,
          _people: staff.map(s => ({ ...s, type: 'person' })),
          _branches: [] 
        };
    });

    const rootData = {
        id: 'root',
        name: this.tenantName() || 'Organization',
        type: 'hq',
        staffCount: hqPeople.length, 
        branchCount: this.branches().length,
        _branches: branchesData,
        _people: hqPeople
    };

    // --- 2. Recursive Tree Build based on Expansion State ---
    const buildTree = (node: any): any => {
        const state = this.expansionState[node.id];
        const newNode = { ...node, children: [] };
        
        if (state === 'branches' && node._branches) {
            newNode.children = node._branches.map(buildTree);
        } else if (state === 'people' && node._people) {
            newNode.children = node._people.map(buildTree);
        }
        
        if (newNode.children.length === 0) delete newNode.children;
        return newNode;
    };

    const computedData = buildTree(rootData);
    const root = d3.hierarchy(computedData);

    // --- 3. Layout Configuration ---
    const nodeWidth = 260; 
    const nodeHeight = 130; 
    
    const treeLayout = d3.tree()
      .nodeSize([nodeWidth + 60, nodeHeight + 80]) 
      .separation((a: any, b: any) => a.parent == b.parent ? 1.1 : 1.3);

    treeLayout(root);

    // --- 4. Rendering ---

    // Links
    g.selectAll('.link')
      .data(root.links())
      .enter().append('path')
      .attr('class', 'link')
      .attr('d', (d: any) => {
        return `M${d.source.x},${d.source.y + nodeHeight / 2}
                V${(d.source.y + d.target.y) / 2}
                H${d.target.x}
                V${d.target.y - nodeHeight / 2}`;
      })
      .attr('stroke-linecap', 'round');

    // Nodes
    const node = g.selectAll('.node')
      .data(root.descendants())
      .enter().append('g')
      .attr('class', 'node')
      .attr('transform', (d: any) => `translate(${d.x},${d.y})`);

    // Node Content
    node.append('foreignObject')
      .attr('width', nodeWidth)
      .attr('height', nodeHeight)
      .attr('x', -nodeWidth / 2)
      .attr('y', -nodeHeight / 2)
      .append('xhtml:div')
      .style('width', '100%')
      .style('height', '100%')
      .html((d: any) => {
        const isHq = d.data.type === 'hq';
        const isPerson = d.data.type === 'person';
        const state = this.expansionState[d.data.id];

        // --- Styles ---
        const cardBase = `width:100%; height:100%; background:white; border-radius:16px; border:1px solid #e2e8f0; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:16px; position:relative; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05); transition: all 0.2s; text-align: center;`;
        const personCard = `width:100%; height:100%; background:#f8fafb; border-radius:16px; border:1px solid #cbd5e1; display:flex; flex-direction:row; align-items:center; justify-content:flex-start; gap:16px; padding:16px; position:relative; text-align: left;`;
        
        // Icons
        const staffIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
        const branchIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>`;
        const userIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

        if (isPerson) {
            return `
              <div style="${personCard}" class="card-text">
                 <div style="width:40px; height:40px; border-radius:50%; background:#e2e8f0; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                   ${userIcon}
                 </div>
                 <div style="overflow:hidden; flex:1;">
                    <div style="font-weight:700; font-size:13px; color:#1e293b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; line-height:1.2;">${d.data.name}</div>
                    <div style="font-size:11px; color:#64748b; text-transform:capitalize; margin-top:2px;">${d.data.role.replace('_', ' ')}</div>
                 </div>
                 <div style="position:absolute; top:-4px; left:50%; transform:translateX(-50%); width:8px; height:8px; background:#cbd5e1; border-radius:50%;"></div>
              </div>
            `;
        }

        const activeBtn = `background:#1e293b; color:white; border-color:#1e293b;`;
        const inactiveBtn = `background:#f1f5f9; color:#475569; border:1px solid transparent;`;
        
        const displayName = d.data.name && d.data.name.trim() !== '' ? d.data.name : 'Unnamed Branch';

        return `
          <div style="${cardBase}" class="card-node card-text">
            ${isHq ? `<div style="position:absolute; top:-10px; padding:2px 10px; background:#1e293b; color:white; font-size:10px; font-weight:bold; border-radius:9999px; z-index:10;">${t.hq}</div>` : ''}
            
            <div style="display:flex; flex-direction:column; align-items:center; width:100%; margin-bottom: 8px;">
                <div style="font-weight:700; color:#0f172a; font-size:15px; margin-bottom:4px; width:100%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    ${displayName}
                </div>
                
                <div style="font-size:12px; color:#64748b; font-weight:500;">
                   ${d.data.location || 'N/A'}
                </div>
            </div>

            ${d.data.warning ? 
              `<div style="display:flex; align-items:center; gap:4px; font-size:10px; color:#ef4444; font-weight:600; margin-bottom:12px; background:#fef2f2; padding:3px 8px; border-radius:4px; border:1px solid #fee2e2;">
                 ! ${d.data.warning}
               </div>` : 
               `<div style="height:23px; margin-bottom:12px;"></div>` // Spacer
            }

            <div style="display:flex; align-items:center; justify-content: center; gap:8px; margin-top:auto; width: 100%;">
              <button 
                class="toggle-btn"
                data-id="${d.data.id}"
                data-mode="people"
                title="${t.staff}"
                style="display:flex; align-items:center; gap:6px; padding:6px 10px; border-radius:8px; font-size:11px; font-weight:600; ${state === 'people' ? activeBtn : inactiveBtn}"
              >
                 ${staffIcon} ${d.data.staffCount}
              </button>

              ${(d.data.branchCount !== undefined && d.data.branchCount > 0) ? 
                `<button 
                   class="toggle-btn"
                   data-id="${d.data.id}"
                   data-mode="branches"
                   title="${t.branches}"
                   style="display:flex; align-items:center; gap:6px; padding:6px 10px; border-radius:8px; font-size:11px; font-weight:600; ${state === 'branches' ? activeBtn : inactiveBtn}"
                 >
                   ${branchIcon} ${d.data.branchCount}
                 </button>` 
                : ''
              }
            </div>
            
             <div style="position:absolute; bottom:-4px; left:50%; transform:translateX(-50%); width:8px; height:8px; background:#cbd5e1; border-radius:50%;"></div>
             ${!isHq ? `<div style="position:absolute; top:-4px; left:50%; transform:translateX(-50%); width:8px; height:8px; background:#cbd5e1; border-radius:50%;"></div>` : ''}
          </div>
        `;
      });

    // --- 5. Event Listeners ---
    setTimeout(() => {
        d3.selectAll('.toggle-btn').on('click', (event: Event) => {
            event.stopPropagation();
            event.preventDefault();
            const target = event.currentTarget as HTMLElement;
            
            const id = target.dataset['id'];
            const mode = target.dataset['mode'];
            if (id && mode) {
                this.toggle(id, mode as 'branches' | 'people');
            }
        });
    }, 0);
  }

  toggle(id: string, mode: 'branches' | 'people') {
      const current = this.expansionState[id];
      if (current === mode) {
          // Collapse
          this.expansionState[id] = null;
          
          // Recursive Collapse Logic
          if (id === 'root') {
             Object.keys(this.expansionState).forEach(key => {
                 if (key !== 'root') {
                     delete this.expansionState[key];
                 }
             });
          }
      } else {
          // Expand
          this.expansionState[id] = mode;
      }
      this.updateGraph();
  }

  printGraph() {
      const printWindow = window.open('', '', 'height=800,width=1000');
      if(printWindow) {
        const svgContent = this.container.nativeElement.querySelector('svg').outerHTML;
        printWindow.document.write(`
          <html>
            <head>
              <title>${this.tenantName()} - Network</title>
              <script src="https://cdn.tailwindcss.com"></script>
              <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
              <style>
                  body { font-family: 'Inter', sans-serif; }
              </style>
            </head>
            <body class="flex justify-center items-center min-h-screen bg-white">
               <div style="width:1000px; height:800px;">${svgContent}</div>
               <script>setTimeout(() => window.print(), 1000);</script>
            </body>
          </html>`);
        printWindow.document.close();
      }
  }
}

