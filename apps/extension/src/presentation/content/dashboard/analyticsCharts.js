import ApexCharts from 'apexcharts';
import { qfToken } from './helpers.js';

const chartMap = new WeakMap();

function empty(el, message) {
    if (!el) return;
    const current = chartMap.get(el);
    if (current) {
        current.destroy();
        chartMap.delete(el);
    }
    el.innerHTML = `<div class="qualiflow-empty qualiflow-dsh-empty" role="status">${message}</div>`;
}

function renderChart(el, options) {
    if (!el) return;
    const current = chartMap.get(el);
    if (current) {
        current.destroy();
        chartMap.delete(el);
    }

    el.innerHTML = '';
    const chart = new ApexCharts(el, options);
    chart.render();
    chartMap.set(el, chart);
}

function palette() {
    return {
        soft: qfToken('--qf-text-softer', '#cbd5e1'),
        muted: qfToken('--qf-text-muted', '#94a3b8'),
        border: qfToken('--qf-border', '#334155'),
        bg: qfToken('--qf-bg', '#0f172a'),
        text: qfToken('--qf-text', '#f8fafc'),
        sky: qfToken('--qf-sky', '#38bdf8'),
        info: qfToken('--qf-info', '#3b82f6'),
        infoStrong: qfToken('--qf-info-strong', '#60a5fa'),
        success: qfToken('--qf-success', '#22c55e'),
        warning: qfToken('--qf-warning', '#f59e0b'),
        danger: qfToken('--qf-danger', '#ef4444'),
        sunken: qfToken('--qf-surface-sunken', '#111827'),
        track: qfToken('--qf-surface', '#1f2937')
    };
}

function baseChartOptions() {
    const c = palette();
    return {
        chart: {
            background: 'transparent',
            foreColor: c.soft,
            toolbar: { show: false },
            animations: { enabled: true, easing: 'easeinout', speed: 420 }
        },
        theme: { mode: 'dark' },
        grid: { borderColor: c.border },
        tooltip: { theme: 'dark' },
        legend: { labels: { colors: c.soft } }
    };
}

function donut(el, items, options = {}) {
    const data = (items || []).filter((d) => d && d.value > 0);
    if (!data.length) {
        empty(el, 'Sem dados para o filtro selecionado.');
        return;
    }

    const labels = data.map((d) => d.label);
    const series = data.map((d) => d.value);
    const colors = data.map((d) => d.color || palette().sky);

    renderChart(el, {
        ...baseChartOptions(),
        chart: {
            ...baseChartOptions().chart,
            type: 'donut',
            height: 250
        },
        labels,
        series,
        colors,
        stroke: { colors: [palette().bg], width: 2 },
        plotOptions: {
            pie: {
                donut: {
                    size: '66%',
                    labels: {
                        show: true,
                        total: {
                            show: true,
                            label: options.caption || 'itens',
                            color: palette().muted
                        }
                    }
                }
            }
        },
        dataLabels: { enabled: false },
        legend: {
            position: 'bottom',
            fontSize: '11px',
            itemMargin: { horizontal: 8, vertical: 4 }
        },
        responsive: [
            {
                breakpoint: 560,
                options: {
                    chart: { height: 220 },
                    legend: { position: 'bottom' }
                }
            }
        ]
    });
}

function line(el, points, options = {}) {
    const data = (points || []).filter((p) => p && typeof p.value === 'number');
    if (!data.length) {
        empty(el, 'Sem histórico para montar tendência.');
        return;
    }

    renderChart(el, {
        ...baseChartOptions(),
        chart: {
            ...baseChartOptions().chart,
            type: 'line',
            height: 250
        },
        series: [{ name: 'Test Cases', data: data.map((d) => d.value) }],
        xaxis: {
            categories: data.map((d) => d.label),
            labels: {
                rotate: -20,
                trim: true,
                style: { colors: palette().muted, fontSize: '10px' }
            }
        },
        yaxis: {
            min: 0,
            labels: { style: { colors: palette().muted } }
        },
        stroke: {
            curve: 'smooth',
            width: 3,
            colors: [options.color || palette().infoStrong]
        },
        markers: {
            size: 4,
            colors: [options.color || palette().infoStrong]
        },
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.25,
                opacityTo: 0.02
            }
        }
    });
}

function radar(el, items) {
    const data = (items || []).filter((d) => d && d.value > 0).slice(0, 6);
    if (!data.length) {
        empty(el, 'Sem dados para radar.');
        return;
    }

    renderChart(el, {
        ...baseChartOptions(),
        chart: {
            ...baseChartOptions().chart,
            type: 'radar',
            height: 250
        },
        series: [{ name: 'Volume', data: data.map((d) => d.value) }],
        labels: data.map((d) => d.label),
        colors: [palette().sky],
        markers: {
            size: 4,
            colors: [palette().sky]
        },
        fill: {
            opacity: 0.2,
            colors: [palette().sky]
        },
        yaxis: {
            labels: { style: { colors: palette().muted, fontSize: '10px' } }
        },
        xaxis: {
            labels: { style: { colors: palette().soft, fontSize: '10px' } }
        }
    });
}

function heatmap(el, rows, cols, values) {
    if (!rows.length || !cols.length) {
        empty(el, 'Sem dados para heatmap.');
        return;
    }

    const series = rows.map((rowName, ri) => ({
        name: rowName,
        data: cols.map((colName, ci) => ({ x: colName, y: values[ri]?.[ci] || 0 }))
    }));

    renderChart(el, {
        ...baseChartOptions(),
        chart: {
            ...baseChartOptions().chart,
            type: 'heatmap',
            height: 270
        },
        series,
        dataLabels: { enabled: false },
        plotOptions: {
            heatmap: {
                shadeIntensity: 0.65,
                radius: 6,
                colorScale: {
                    ranges: [
                        { from: 0, to: 0, color: palette().sunken, name: '0' },
                        { from: 1, to: 2, color: palette().info, name: 'baixo' },
                        { from: 3, to: 5, color: palette().success, name: 'medio' },
                        { from: 6, to: 10, color: palette().warning, name: 'alto' },
                        { from: 11, to: 999999, color: palette().danger, name: 'muito alto' }
                    ]
                }
            }
        },
        xaxis: {
            labels: { style: { colors: palette().muted, fontSize: '10px' } }
        },
        yaxis: {
            labels: { style: { colors: palette().soft, fontSize: '10px' } }
        }
    });
}

function gauge(el, value, label) {
    const pct = Math.max(0, Math.min(100, value || 0));
    const c = palette();
    const color = pct >= 80 ? c.success : pct >= 60 ? c.warning : c.danger;

    renderChart(el, {
        ...baseChartOptions(),
        chart: {
            ...baseChartOptions().chart,
            type: 'radialBar',
            height: 250
        },
        series: [pct],
        colors: [color],
        plotOptions: {
            radialBar: {
                startAngle: -140,
                endAngle: 140,
                hollow: {
                    size: '58%',
                    background: c.sunken
                },
                track: {
                    background: c.track,
                    strokeWidth: '100%'
                },
                dataLabels: {
                    name: {
                        show: true,
                        color: c.muted,
                        offsetY: 40,
                        fontSize: '12px'
                    },
                    value: {
                        offsetY: -2,
                        color: c.text,
                        fontSize: '28px',
                        fontWeight: 700,
                        formatter: (val) => `${Math.round(val)}%`
                    }
                }
            }
        },
        labels: [label || 'Execução']
    });
}

export const QaCharts = {
    donut,
    line,
    radar,
    heatmap,
    gauge
};
