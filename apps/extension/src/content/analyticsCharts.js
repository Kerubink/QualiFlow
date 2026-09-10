import ApexCharts from 'apexcharts';

(function () {
    if (globalThis.QaCharts) return;

    const chartMap = new WeakMap();

    function empty(el, message) {
        if (!el) return;
        const current = chartMap.get(el);
        if (current) {
            current.destroy();
            chartMap.delete(el);
        }
        el.innerHTML = `<div style="color:#94a3b8; font-size:0.82rem;">${message}</div>`;
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

    function baseChartOptions() {
        return {
            chart: {
                background: 'transparent',
                foreColor: '#cbd5e1',
                toolbar: { show: false },
                animations: { enabled: true, easing: 'easeinout', speed: 420 }
            },
            theme: { mode: 'dark' },
            grid: { borderColor: '#334155' },
            tooltip: { theme: 'dark' },
            legend: { labels: { colors: '#cbd5e1' } }
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
        const colors = data.map((d) => d.color || '#38bdf8');

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
            stroke: { colors: ['#0f172a'], width: 2 },
            plotOptions: {
                pie: {
                    donut: {
                        size: '66%',
                        labels: {
                            show: true,
                            total: {
                                show: true,
                                label: options.caption || 'itens',
                                color: '#94a3b8'
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
                    style: { colors: '#94a3b8', fontSize: '10px' }
                }
            },
            yaxis: {
                min: 0,
                labels: { style: { colors: '#94a3b8' } }
            },
            stroke: {
                curve: 'smooth',
                width: 3,
                colors: [options.color || '#60a5fa']
            },
            markers: {
                size: 4,
                colors: [options.color || '#60a5fa']
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
            colors: ['#38bdf8'],
            markers: {
                size: 4,
                colors: ['#7dd3fc']
            },
            fill: {
                opacity: 0.2,
                colors: ['#38bdf8']
            },
            yaxis: {
                labels: { style: { colors: '#94a3b8', fontSize: '10px' } }
            },
            xaxis: {
                labels: { style: { colors: '#cbd5e1', fontSize: '10px' } }
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
                            { from: 0, to: 0, color: '#111827', name: '0' },
                            { from: 1, to: 2, color: '#2563eb', name: 'baixo' },
                            { from: 3, to: 5, color: '#16a34a', name: 'medio' },
                            { from: 6, to: 10, color: '#f59e0b', name: 'alto' },
                            { from: 11, to: 999999, color: '#ef4444', name: 'muito alto' }
                        ]
                    }
                }
            },
            xaxis: {
                labels: { style: { colors: '#94a3b8', fontSize: '10px' } }
            },
            yaxis: {
                labels: { style: { colors: '#cbd5e1', fontSize: '10px' } }
            }
        });
    }

    function gauge(el, value, label) {
        const pct = Math.max(0, Math.min(100, value || 0));
        const color = pct >= 80 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444';

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
                        background: '#111827'
                    },
                    track: {
                        background: '#1f2937',
                        strokeWidth: '100%'
                    },
                    dataLabels: {
                        name: {
                            show: true,
                            color: '#94a3b8',
                            offsetY: 40,
                            fontSize: '12px'
                        },
                        value: {
                            offsetY: -2,
                            color: '#f8fafc',
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

    globalThis.QaCharts = {
        donut,
        line,
        radar,
        heatmap,
        gauge
    };
})();
