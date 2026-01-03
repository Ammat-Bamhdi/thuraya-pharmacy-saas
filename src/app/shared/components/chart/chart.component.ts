/**
 * @fileoverview Sales chart visualization using D3.js
 * @author Thuraya Systems
 * @created 2026-01-03
 * @updated 2026-01-03
 */

import { Component, ElementRef, OnInit, ViewChild, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

declare var d3: any;

/**
 * @component SalesChartComponent
 * @description Reusable sales chart with D3.js visualization
 * 
 * @features
 * - Line chart with area gradient
 * - Responsive canvas rendering
 * - Animated transitions
 * - Grid lines and axes
 * 
 * @dependencies
 * - D3.js: Chart rendering library
 * 
 * @example
 * <app-sales-chart></app-sales-chart>
 * 
 * @architecture
 * - OnPush change detection
 * - ViewEncapsulation.None for D3 styles
 * - ViewChild for canvas access
 * 
 * @since 1.0.0
 */
@Component({
  selector: 'app-sales-chart',
  standalone: true,
  imports: [CommonModule],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chart.component.html',
  styles: [`
    .line {
      fill: none;
      stroke: #73E0C0;
      stroke-width: 3px;
    }
    .area {
      fill: url(#gradient);
      opacity: 0.3;
    }
    .axis-grid line {
      stroke: rgba(0,0,0,0.05);
    }
    .axis-text {
      font-family: 'Inter', sans-serif;
      font-size: 10px;
      fill: #64748B;
    }
    .domain {
      display: none;
    }
  `]
})
export class SalesChartComponent implements OnInit {
  // ========================================
  // VIEW CHILDREN
  // ========================================
  
  /**
   * Reference to chart container element for D3 rendering
   */
  @ViewChild('chartContainer', { static: true }) chartContainer!: ElementRef;

  // ========================================
  // LIFECYCLE
  // ========================================
  
  /**
   * Initialize chart on component load
   * @returns {void}
   */
  ngOnInit(): void {
    this.createChart();
    window.addEventListener('resize', () => this.createChart());
  }

  createChart() {
    const element = this.chartContainer.nativeElement;
    d3.select(element).selectAll('*').remove();

    const data = [
      { date: new Date(2025, 0, 1), value: 1200 },
      { date: new Date(2025, 0, 2), value: 1800 },
      { date: new Date(2025, 0, 3), value: 1600 },
      { date: new Date(2025, 0, 4), value: 2400 },
      { date: new Date(2025, 0, 5), value: 2100 },
      { date: new Date(2025, 0, 6), value: 3200 },
      { date: new Date(2025, 0, 7), value: 2900 }
    ];

    const margin = { top: 20, right: 20, bottom: 30, left: 40 };
    const width = element.offsetWidth - margin.left - margin.right;
    const height = element.offsetHeight - margin.top - margin.bottom;

    const svg = d3.select(element)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Gradient
    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', 'gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    gradient.append('stop').attr('offset', '0%').attr('stop-color', '#73E0C0');
    gradient.append('stop').attr('offset', '100%').attr('stop-color', '#ffffff').attr('stop-opacity', 0);

    // Scales
    const x = d3.scaleTime()
      .domain(d3.extent(data, (d: any) => d.date))
      .range([0, width]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, (d: any) => d.value) * 1.2])
      .range([height, 0]);

    // Area
    const area = d3.area()
      .x((d: any) => x(d.date))
      .y0(height)
      .y1((d: any) => y(d.value))
      .curve(d3.curveMonotoneX);

    svg.append('path')
      .datum(data)
      .attr('class', 'area')
      .attr('d', area);

    // Line
    const line = d3.line()
      .x((d: any) => x(d.date))
      .y((d: any) => y(d.value))
      .curve(d3.curveMonotoneX);

    svg.append('path')
      .datum(data)
      .attr('class', 'line')
      .attr('d', line);

    // X Axis
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(5).tickSize(0).tickPadding(10))
      .attr('class', 'axis-text')
      .selectAll('text')
      .style('font-family', 'Inter');

    // Y Axis
    svg.append('g')
      .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickPadding(10))
      .attr('class', 'axis-text axis-grid')
      .selectAll('line')
      .style('stroke-dasharray', '3,3');
  }
}
