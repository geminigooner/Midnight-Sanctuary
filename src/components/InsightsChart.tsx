import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { JewelMetrics } from '../lib/types';

export const InsightsChart = ({ metrics }: { metrics: JewelMetrics }) => {
  const d3Container = useRef(null);

  useEffect(() => {
    if (d3Container.current) {
      // Mock data based roughly on total messages to give it some life
      const baseCount = Math.max(1, Math.floor((metrics?.totalMessages || 10) / 7));
      const data = [
        { day: 'Mon', value: baseCount * 0.8 },
        { day: 'Tue', value: baseCount * 1.2 },
        { day: 'Wed', value: baseCount * 1.5 },
        { day: 'Thu', value: baseCount * 0.9 },
        { day: 'Fri', value: baseCount * 1.1 },
        { day: 'Sat', value: baseCount * 2.0 },
        { day: 'Sun', value: baseCount * 1.8 }
      ];

      const margin = { top: 20, right: 20, bottom: 30, left: 40 };
      const width = 400 - margin.left - margin.right;
      const height = 250 - margin.top - margin.bottom;

      // Clear previous
      d3.select(d3Container.current).selectAll('*').remove();

      const svg = d3.select(d3Container.current)
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      const x = d3.scaleBand()
        .range([0, width])
        .domain(data.map(d => d.day))
        .padding(0.2);

      const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.value) || 10])
        .range([height, 0]);

      // X Axis
      svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll('text')
        .style('fill', '#E0B1CB') // mauve
        .style('font-family', 'monospace');
        
      svg.selectAll('.domain, .tick line').style('stroke', '#4E31AA'); // copper/glass

      // Y Axis
      svg.append('g')
        .call(d3.axisLeft(y).ticks(5))
        .selectAll('text')
        .style('fill', '#E0B1CB')
        .style('font-family', 'monospace');
        
      svg.selectAll('.domain, .tick line').style('stroke', '#4E31AA');

      // Bars
      svg.selectAll('rect')
        .data(data)
        .enter()
        .append('rect')
        .attr('x', d => x(d.day) as number)
        .attr('y', d => y(d.value))
        .attr('width', x.bandwidth())
        .attr('height', d => height - y(d.value))
        .attr('fill', '#4E31AA')
        .attr('rx', 4)
        .on('mouseover', function() {
          d3.select(this).attr('fill', '#F5DDE7'); // champagne
        })
        .on('mouseout', function() {
          d3.select(this).attr('fill', '#4E31AA');
        });
    }
  }, [metrics]);

  return (
    <div className="flex flex-col items-center w-full">
      <div className="text-sm text-[#F5E1C8] mb-4 font-bold tracking-tight">Weekly Interaction Frequency</div>
      <div className="w-full overflow-x-auto flex justify-center">
        <div ref={d3Container} className="min-w-[400px]" />
      </div>
    </div>
  );
};
