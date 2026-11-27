/* Chart.js setup shared by every chart: theme colours, one y-axis per chart,
   thin lines, hover crosshair + tooltip. */
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend
} from "chart.js";
import { fmt } from "./params.js";

const crosshair = {
  id: "crosshair",
  afterDatasetsDraw(chart) {
    const a = chart.tooltip?.getActiveElements?.();
    if (!a?.length) return;
    const x = a[0].element.x, { top, bottom } = chart.chartArea, ctx = chart.ctx;
    ctx.save();
    ctx.strokeStyle = chart.options.plugins.crosshair?.color || "#888";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
    ctx.restore();
  }
};

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend, crosshair);
ChartJS.defaults.font.family = "Geist, ui-sans-serif, system-ui, sans-serif";

export function lineOptions(c, { unit = "", digits = 2, legend = false, yTitle } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: "index", intersect: false },
    layout: { padding: { top: 6, right: 4 } },
    plugins: {
      legend: {
        display: legend, position: "top", align: "end",
        labels: { color: c.ink2, boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: "circle", padding: 14, font: { size: 12 } }
      },
      crosshair: { color: c.axis },
      tooltip: {
        backgroundColor: c.surface, borderColor: c.line, borderWidth: 1, padding: 10, cornerRadius: 8,
        titleColor: c.muted, bodyColor: c.ink, titleFont: { size: 11.5, weight: "500" }, bodyFont: { size: 12.5, weight: "500" },
        boxWidth: 8, boxHeight: 8, usePointStyle: true, boxPadding: 4,
        callbacks: { label: x => ` ${x.dataset.label}: ${fmt(x.parsed.y, digits)} ${unit}` }
      }
    },
    elements: { point: { radius: 0, hoverRadius: 4, hoverBorderWidth: 2, hoverBorderColor: c.surface } },
    scales: {
      x: {
        grid: { display: false }, border: { color: c.axis },
        ticks: { color: c.muted, maxTicksLimit: 7, maxRotation: 0, font: { size: 11 } }
      },
      y: {
        grid: { color: c.grid }, border: { display: false },
        title: yTitle ? { display: true, text: yTitle, color: c.muted, font: { size: 11 } } : { display: false },
        ticks: { color: c.muted, maxTicksLimit: 5, padding: 8, font: { size: 11 } }
      }
    }
  };
}

export function series(label, data, color, { fill = false } = {}) {
  return {
    label, data, borderColor: color, backgroundColor: color, pointBackgroundColor: color,
    borderWidth: 2, tension: 0.3, spanGaps: true,
    fill: fill ? { target: "origin", above: color + "14" } : false
  };
}

export function barOptions(c, { unit = "", digits = 2, legend = true } = {}) {
  const o = lineOptions(c, { unit, digits, legend });
  o.interaction = { mode: "index", intersect: false };
  o.plugins.crosshair = { color: "transparent" };
  o.scales.x.ticks.maxTicksLimit = 12;
  o.scales.y.beginAtZero = true;
  o.datasets = { bar: { borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: "bottom", maxBarThickness: 22, categoryPercentage: 0.7, barPercentage: 0.9 } };
  return o;
}

export function bars(label, data, color) {
  return { label, data, backgroundColor: color, hoverBackgroundColor: color, borderWidth: 0 };
}

