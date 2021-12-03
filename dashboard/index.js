/**
 * Dashboard performance demo.
 *
 * - Several different real-time features working simultaneously.
 * - Responsive UI.
 *
 * Features:
 * - Real-time multi channel line chart.
 * - Scrolling heatmap.                 } These two can show same data, and be next to each other.
 * - Animated 3D surface.               }
 * - Box Chart 3D (based on example)
 * - Animated Pie, Gauge and Spider charts.     } These can be grouped somewhere.
 *
 * (+) Animated scatter chart.
 */

 const {
     createProgressiveTraceGenerator,
     createSpectrumDataGenerator,
     createWaterDropDataGenerator
} = xydata;

const {
    AxisScrollStrategies,
    AxisTickStrategies,
    AutoCursorModes,
    PointShape,
    ColorShadingStyles,
    ColorHSV,
    ColorRGBA,
    PalettedFill,
    emptyLine,
    LUT,
    lightningChart,
    LegendBoxBuilders,
    Themes,
} = lcjs;
 
 // eslint-disable-next-line @typescript-eslint/no-var-requires
 const ecgPromise = fetch('./data-ecg.json')
    .then(r => r.json())
 
 const CONFIG = {
     REALTIME_LINE_CHANNELS_COUNT: 10,
     REALTIME_LINE_SAMPLE_FREQUENCYHZ: 100,
     STATIC_LINE_TRENDS_COUNT: 20,
     STATIC_LINE_DATA_PER_TREND: 100000,
     SCATTER_DATASET_COUNT: 5,
     SCATTER_DATASET_SIZE: 5000,
     SCATTER_DATASET_FREQUENCYMS: 100,
     SPECTROGRAM_SAMPLE_RESOLUTION: 100,
     SPECTROGRAM_HISTORYMS: 5000,
     BOX_COLUMNS: 10,
     BOX_ROWS: 5,
     BOX_DATASET_COUNT: 100,
     LEGENDS: true,
     TICKS: true,
 }
 
 const theme = Themes[(localStorage.getItem('lcjs-theme')) || 'blueSciFiNew']
 // #region Theme selector UI
 ;(() => {
     function addStyle(styleString) {
         const style = document.createElement('style')
         style.textContent = styleString
         document.head.append(style)
     }
     addStyle(`
     /* Dropdown Button */
     .dropbtn {
     background-color: #4CAF50;
     color: white;
     padding: 16px;
     font-size: 16px;
     border: none;
     }
 
     /* The container <div> - needed to position the dropdown content */
     .dropdown {
     position: fixed;
     display: inline-block;
     z-index: 99999;
     }
 
     /* Dropdown Content (Hidden by Default) */
     .dropdown-content {
     display: none;
     position: absolute;
     background-color: #f1f1f1;
     min-width: 160px;
     box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2);
     z-index: 1;
     }
 
     /* Links inside the dropdown */
     .dropdown-content a {
     color: black;
     padding: 12px 16px;
     text-decoration: none;
     display: block;
     }
 
     /* Change color of dropdown links on hover */
     .dropdown-content a:hover {background-color: #ddd;}
 
     /* Show the dropdown menu on hover */
     .dropdown:hover .dropdown-content {display: block;}
 
     /* Change the background color of the dropdown button when the dropdown content is shown */
     .dropdown:hover .dropbtn {background-color: #3e8e41;}
     `)
     const dropdown = document.createElement('div')
     dropdown.className = 'dropdown'
     const button = document.createElement('button')
     button.className = 'dropbtn'
     const label = document.createElement('label')
     label.innerHTML = 'Theme'
     button.appendChild(label)
     const content = document.createElement('div')
     content.className = 'dropdown-content'
     // eslint-disable-next-line guard-for-in
     for (const themeName of [
         'darkGold',
         'lightNew',
         'darkGreen',
         'darkLime',
         'darkMagenta',
         'darkRed',
         'darkTurquoise',
         'duskInLapland',
         'glacier',
         'lightNature',
         'darkNature',
         'auroraBorealisNew',
         'blueSciFiNew',
         'cyberSpace',
     ]) {
         const buttonTheme = Themes[themeName]
         if (buttonTheme) {
             const option = document.createElement('button')
             option.innerText = themeName
             // eslint-disable-next-line @typescript-eslint/no-loop-func
             option.onclick = () => {
                 localStorage.setItem('lcjs-theme', themeName)
                 window.location.reload()
             }
             content.appendChild(option)
         }
     }
     button.appendChild(content)
     dropdown.appendChild(button)
     document.body.appendChild(dropdown)
 })()
 // #endregion
 
 const dashboard = lightningChart().Dashboard({
     theme,
     numberOfColumns: 3,
     numberOfRows: 6,
 })
 
 const startFunctionArray = []
 
 // #region Column 1: Line chart + Scatter chart + Static line chart
 
 let lineChartIncomingDataCount = 0
 let lineChartDataProcessTime = 0
 // #region *** Line chart ***
 ;(() => {
     const chart = dashboard
         .createChartXY({
             columnIndex: 0,
             rowIndex: 0,
             rowSpan: 2,
         })
         .setTitle('Multichannel real-time line chart')
     const axisX = chart
         .getDefaultAxisX()
         .setTickStrategy(AxisTickStrategies.Time)
         .setScrollStrategy(AxisScrollStrategies.progressive)
         .setInterval(-10000, 0)
     const axisY = chart.getDefaultAxisY().setTickStrategy(AxisTickStrategies.Empty).setTitle('Channels')
     if (!CONFIG.TICKS) {
         chart.getDefaultAxisX().setTickStrategy(AxisTickStrategies.Empty)
         chart.getDefaultAxisY().setTickStrategy(AxisTickStrategies.Empty)
     }
     const seriesArray = new Array(CONFIG.REALTIME_LINE_CHANNELS_COUNT).fill(0).map((_, iChannel) =>
         chart
             .addLineSeries({
                 dataPattern: {
                     pattern: 'ProgressiveX',
                 },
             })
             .setStrokeStyle((stroke) => stroke.setThickness(1))
             .setName(`Channel #${iChannel + 1}`),
     )
     ecgPromise.then(ecg => {
        const ecgLength = ecg.length
        let samples = 0
        let newDataModulus = 0
        let tPrev = 0
        const xMultiplier = 1000 / CONFIG.REALTIME_LINE_SAMPLE_FREQUENCYHZ
        const ySampleMultiplier = 10000 / CONFIG.REALTIME_LINE_SAMPLE_FREQUENCYHZ
        const addData = () => {
            const tNow = performance.now()
            const tDelta = tNow - tPrev
            let newDataPointsCount = CONFIG.REALTIME_LINE_SAMPLE_FREQUENCYHZ * (tDelta / 1000) + newDataModulus
            newDataModulus = newDataPointsCount % 1
            newDataPointsCount = Math.floor(newDataPointsCount)
    
            if (newDataPointsCount > 0) {
                seriesArray.forEach((series, iChannel) => {
                    const points = []
                    for (let i = 0; i < newDataPointsCount; i += 1) {
                        const iSample = samples + i
                        const x = iSample * xMultiplier
                        const y = ecg[(iSample * ySampleMultiplier) % ecgLength] + iChannel
                        points.push({
                            x,
                            y,
                        })
                    }
                    series.add(points)
                })
                samples += newDataPointsCount
                lineChartIncomingDataCount += CONFIG.REALTIME_LINE_CHANNELS_COUNT * newDataPointsCount
            }
    
            lineChartDataProcessTime += window.performance.now() - tNow
            tPrev = window.performance.now()
            requestAnimationFrame(addData)
        }
        startFunctionArray.push(addData)
     })
     if (CONFIG.LEGENDS) {
         chart.addLegendBox().add(chart)
     }
 })()
 
 // #endregion
 
 let scatterChartIncomingDataCount = 0
 let scatterChartDataProcessTime = 0
 // #region *** Scatter chart ***
 ;(() => {
     const chart = dashboard
         .createChartXY({
             columnIndex: 0,
             rowIndex: 2,
             rowSpan: 2,
         })
         .setTitle('Animated scatter chart')
     const axisX = chart.getDefaultAxisX().setScrollStrategy(undefined).setInterval(0, 1)
     const axisY = chart.getDefaultAxisY().setScrollStrategy(undefined).setInterval(0, 1)
     if (!CONFIG.TICKS) {
         chart.getDefaultAxisX().setTickStrategy(AxisTickStrategies.Empty)
         chart.getDefaultAxisY().setTickStrategy(AxisTickStrategies.Empty)
     }
 
     const scatterSeries = chart.addPointSeries({ pointShape: PointShape.Circle }).setPointSize(3).setName('Scatter series')
     if (CONFIG.LEGENDS) {
         chart.addLegendBox().add(chart)
     }
 
     const dataSets = new Array(CONFIG.SCATTER_DATASET_COUNT).fill(0).map((_) =>
         new Array(CONFIG.SCATTER_DATASET_SIZE).fill(0).map((__) => ({
             x: Math.random(),
             y: Math.random(),
         })),
     )
     let iDataset = 0
     let tPrevSwitch = window.performance.now()
     const check = () => {
         const now = window.performance.now()
         if (!scatterSeries.isDisposed() && now - tPrevSwitch >= CONFIG.SCATTER_DATASET_FREQUENCYMS) {
             tPrevSwitch = now
             iDataset = (iDataset + 1) % (CONFIG.SCATTER_DATASET_COUNT - 1)
             scatterSeries.clear().add(dataSets[iDataset])
             scatterChartIncomingDataCount += CONFIG.SCATTER_DATASET_SIZE
         }
         scatterChartDataProcessTime += window.performance.now() - now
         requestAnimationFrame(check)
     }
     startFunctionArray.push(check)
 })()
 
 // #endregion
 
 // #region *** Static Line chart ***
 ;(() => {
     const chart = dashboard
         .createChartXY({
             columnIndex: 0,
             rowIndex: 4,
             rowSpan: 2,
         })
         .setTitle(
             `Static line chart | ${((CONFIG.STATIC_LINE_TRENDS_COUNT * CONFIG.STATIC_LINE_DATA_PER_TREND) / 10 ** 6).toFixed(
                 1,
             )} million data points`,
         )
 
     if (!CONFIG.TICKS) {
         chart.getDefaultAxisX().setTickStrategy(AxisTickStrategies.Empty)
         chart.getDefaultAxisY().setTickStrategy(AxisTickStrategies.Empty)
     }
     const seriesArray = new Array(CONFIG.STATIC_LINE_TRENDS_COUNT).fill(0).map((_) =>
         chart
             .addLineSeries({
                 dataPattern: {
                     pattern: 'ProgressiveX',
                     regularProgressiveStep: true,
                 },
             })
             .setStrokeStyle((stroke) => stroke.setThickness(1)),
     )
 
     seriesArray.forEach((series, iChannel) => {
         createProgressiveTraceGenerator()
             .setNumberOfPoints(CONFIG.STATIC_LINE_DATA_PER_TREND)
             .generate()
             .toPromise()
             .then((data) => series.add(data))
     })
 
     // if (CONFIG.LEGENDS) {
     //     chart.addLegendBox().add(chart)
     // }
 })()
 
 // #endregion
 
 // #endregion
 
 // #region Column 2: Heatmap + Surface + Box
 
 let heatmap
     // #region *** Heatmap ***
 ;(() => {
     const chart = dashboard
         .createChartXY({
             columnIndex: 1,
             rowIndex: 0,
             rowSpan: 2,
         })
         .setTitle('Real-time 2D spectrogram chart')
 
     const axisX = chart
         .getDefaultAxisX()
         .setScrollStrategy(AxisScrollStrategies.progressive)
         .setInterval(-CONFIG.SPECTROGRAM_HISTORYMS, 0)
         .setTickStrategy(AxisTickStrategies.Time)
 
     if (!CONFIG.TICKS) {
         chart.getDefaultAxisX().setTickStrategy(AxisTickStrategies.Empty)
         chart.getDefaultAxisY().setTickStrategy(AxisTickStrategies.Empty)
     }
     heatmap = chart
         .addHeatmapScrollingGridSeries({
             scrollDimension: 'columns',
             resolution: CONFIG.SPECTROGRAM_SAMPLE_RESOLUTION,
             step: {
                 x: 1000 / 60,
                 y: 1,
             },
         })
         .setName(`Spectrogram`)
         .setDataCleaning({ minDataPointCount: 1 })
         .setFillStyle(
             new PalettedFill({
                 lookUpProperty: 'value',
                 lut: new LUT({
                     steps: [
                         { value: 0, label: '0', color: ColorHSV(0, 1, 0) },
                         { value: 0.15, label: '15', color: ColorHSV(270, 0.84, 0.2) },
                         { value: 0.3, label: '30', color: ColorHSV(289, 0.86, 0.35) },
                         { value: 0.45, label: '45', color: ColorHSV(324, 0.97, 0.56) },
                         { value: 0.6, label: '60', color: ColorHSV(1, 1, 1) },
                         { value: 0.75, label: '75', color: ColorHSV(44, 0.64, 1) },
                     ],
                     units: 'dB',
                     interpolate: true,
                 }),
             }),
         )
         .setWireframeStyle(emptyLine)
 
     if (CONFIG.LEGENDS) {
         chart.addLegendBox().add(chart)
     }
 })()
 
 // #endregion
 
 let surface
     // #region *** Surface ***
 ;(() => {
     const chart = dashboard
         .createChart3D({
             columnIndex: 1,
             rowIndex: 2,
             rowSpan: 2,
         })
         .setTitle('Real-time 3D spectrogram chart')
         .setBoundingBox({
             x: 1,
             y: 1,
             z: 2,
         })
 
     // NOTE: With scrolling surface grid, explicitly configuring Y Axis interval like this results in SIGNIFICANTLY better performance.
     const axisY = chart.getDefaultAxisY().setInterval(0, 1, false, true)
 
     const axisZ = chart
         .getDefaultAxisZ()
         .setScrollStrategy(AxisScrollStrategies.progressive)
         .setInterval(-CONFIG.SPECTROGRAM_HISTORYMS, 0)
         .setTickStrategy(AxisTickStrategies.Time)
 
     const stepZ = 1000 / 60
     const rows = Math.floor(CONFIG.SPECTROGRAM_HISTORYMS / stepZ)
 
     if (!CONFIG.TICKS) {
         chart.getDefaultAxisX().setTickStrategy(AxisTickStrategies.Empty)
         chart.getDefaultAxisY().setTickStrategy(AxisTickStrategies.Empty)
         chart.getDefaultAxisZ().setTickStrategy(AxisTickStrategies.Empty)
     }
     surface = chart
         .addSurfaceScrollingGridSeries({
             scrollDimension: 'rows',
             columns: CONFIG.SPECTROGRAM_SAMPLE_RESOLUTION,
             rows,
             step: {
                 x: 1,
                 z: stepZ,
             },
         })
         .setName(`Spectrogram`)
         .setFillStyle(
             new PalettedFill({
                 lookUpProperty: 'y',
                 lut: new LUT({
                     steps: [
                         { value: 0, label: '0', color: ColorHSV(0, 1, 0) },
                         { value: 0.15, label: '15', color: ColorHSV(270, 0.84, 0.2) },
                         { value: 0.3, label: '30', color: ColorHSV(289, 0.86, 0.35) },
                         { value: 0.45, label: '45', color: ColorHSV(324, 0.97, 0.56) },
                         { value: 0.6, label: '60', color: ColorHSV(1, 1, 1) },
                         { value: 0.75, label: '75', color: ColorHSV(44, 0.64, 1) },
                     ],
                     units: 'dB',
                     interpolate: true,
                 }),
             }),
         )
         .setWireframeStyle(emptyLine)
         .setColorShadingStyle(new ColorShadingStyles.Simple())
 
     if (CONFIG.LEGENDS) {
         chart.addLegendBox().add(chart)
     }
 })()
 
 // #endregion
 
 let heatmapChartIncomingDataCount = 0
 let heatmapChartDataProcessTime = 0
 let surfaceChartIncomingDataCount = 0
 let surfaceChartDataProcessTime = 0
 // #region *** Heatmap + Surface data stream
 createSpectrumDataGenerator()
     .setNumberOfSamples(100)
     .setSampleSize(CONFIG.SPECTROGRAM_SAMPLE_RESOLUTION)
     .setVariation(2)
     .generate()
     .toPromise()
     .then((data) => {
         let iSample = 0
         const dataLen = data.length
         const addData = () => {
             const sample = data[iSample % dataLen]
             if (!heatmap.isDisposed()) {
                 const now = window.performance.now()
                 heatmap.addIntensityValues([sample])
                 heatmapChartIncomingDataCount += CONFIG.SPECTROGRAM_SAMPLE_RESOLUTION
                 heatmapChartDataProcessTime += window.performance.now() - now
             }
             if (!surface.isDisposed()) {
                 const now = window.performance.now()
                 surface.addValues({
                     yValues: [sample],
                 })
                 surfaceChartIncomingDataCount += CONFIG.SPECTROGRAM_SAMPLE_RESOLUTION
                 surfaceChartDataProcessTime += window.performance.now() - now
             }
             iSample += 1
             requestAnimationFrame(addData)
         }
         startFunctionArray.push(addData)
     })
 
 // #endregion
 
 let boxChartIncomingDataCount = 0
 let boxChartDataProcessTime = 0
 // #region *** 3D Box chart ***
 ;(() => {
     const chart = dashboard
         .createChart3D({
             columnIndex: 1,
             rowIndex: 4,
             rowSpan: 2,
         })
         .setTitle(`Real-time 3D box chart`)
     chart.setCameraLocation({
         x: 1.0,
         y: 2,
         z: 1.3,
     })
 
     const axisY = chart.getDefaultAxisY().setScrollStrategy(AxisScrollStrategies.expansion).setInterval(0, 1)
 
     if (!CONFIG.TICKS) {
         chart.getDefaultAxisX().setTickStrategy(AxisTickStrategies.Empty)
         chart.getDefaultAxisY().setTickStrategy(AxisTickStrategies.Empty)
         chart.getDefaultAxisZ().setTickStrategy(AxisTickStrategies.Empty)
     }
     const boxSeries = chart.addBoxSeries().setFillStyle(
         new PalettedFill({
             lookUpProperty: 'y',
             lut: new LUT({
                 steps: [
                     { value: 0, color: ColorRGBA(0, 0, 0) },
                     { value: 30, color: ColorRGBA(255, 255, 0) },
                     { value: 45, color: ColorRGBA(255, 204, 0) },
                     { value: 60, color: ColorRGBA(255, 128, 0) },
                     { value: 100, color: ColorRGBA(255, 0, 0) },
                 ],
                 interpolate: true,
             }),
         }),
     )
 
     const rows = CONFIG.BOX_ROWS
     const columns = CONFIG.BOX_COLUMNS
 
     createWaterDropDataGenerator()
         .setRows(rows)
         .setColumns(columns)
         .generate()
         .then((srcData) => {
             const initialData = []
             for (let iColumn = 0; iColumn < columns; iColumn += 1) {
                 const iColumnPremultiplied = iColumn * rows
                 for (let iRow = 0; iRow < rows; iRow += 1) {
                     initialData.push({
                         id: String(iColumnPremultiplied + iRow),
                         xCenter: iColumn,
                         zCenter: iRow,
                         yCenter: 0,
                         xSize: 1,
                         zSize: 1,
                         ySize: 0,
                     })
                 }
             }
             const dataFrames = []
             for (let i = 0; i < CONFIG.BOX_DATASET_COUNT; i += 1) {
                 const frame = []
                 dataFrames.push(frame)
                 const t = (Math.PI * 2 * (i + 1)) / CONFIG.BOX_DATASET_COUNT
                 for (let iColumn = 0; iColumn < columns; iColumn += 1) {
                     const iColumnPremultiplied = iColumn * rows
                     for (let iRow = 0; iRow < rows; iRow += 1) {
                         const height = Math.max(
                             srcData[iRow][iColumn] + 50 * Math.sin(t + iColumn * 0.5) + 40 * Math.sin(t + iRow * 1.0),
                             0,
                         )
                         frame.push({
                             id: String(iColumnPremultiplied + iRow),
                             yCenter: height / 2,
                             ySize: height,
                         })
                     }
                 }
             }
             return { initialData, dataFrames }
         })
         .then((data) => {
             let iFrame = -1
             const updateData = () => {
                 const now = window.performance.now()
                 if (!boxSeries.isDisposed()) {
                     iFrame = (iFrame + 1) % data.dataFrames.length
                     const frameData = data.dataFrames[iFrame]
                     boxSeries.invalidateData(frameData)
                     boxChartIncomingDataCount += columns * rows
                 }
                 boxChartDataProcessTime += window.performance.now() - now
                 requestAnimationFrame(updateData)
             }
             startFunctionArray.push(() => {
                 boxSeries.invalidateData(data.initialData)
                 requestAnimationFrame(updateData)
             })
         })
 
     if (CONFIG.LEGENDS) {
         chart.addLegendBox().add(chart)
     }
 })()
 
 // #endregion
 
 // #endregion
 
 // #region Column 3: Gauge, Pie, Spider
 
 // #region *** Gauge ***
 ;(() => {
     const chart = dashboard
         .createGaugeChart({
             columnIndex: 2,
             rowIndex: 0,
             rowSpan: 2,
         })
         .setTitle('Animated gauge chart | Refresh rate')
         .setAngleInterval(225, -45)
         .setDataLabelFormatter((value) => `Refresh rate: ${value.toFixed(1)} times per second`)
 
     const slice = chart.getDefaultSlice().setInterval(0, 60).setName('Refresh rate')
 
     let tStart = Date.now()
     let frames = 0
     let fps = 0
     const recordFrame = () => {
         frames++
         const tNow = Date.now()
         fps = 1000 / ((tNow - tStart) / frames)
         requestAnimationFrame(recordFrame)
     }
     requestAnimationFrame(recordFrame)
 
     setInterval(() => {
         slice.setValue(fps)
     }, 1000)
 
     setInterval(() => {
         tStart = Date.now()
         frames = 0
     }, 5000)
 
     if (CONFIG.LEGENDS) {
         chart.addLegendBox(LegendBoxBuilders.HorizontalLegendBox).add(chart)
     }
 })()
 
 // #endregion
 
 // #region *** Pie ***
 ;(() => {
     const chart = dashboard
         .createPieChart({
             columnIndex: 2,
             rowIndex: 2,
             rowSpan: 2,
         })
         .setTitle('Animated Pie Chart | Incoming data amount / second')
 
     const categories = ['Line', 'Scatter', 'Spectrogram 2D', 'Spectrogram 3D', 'Box 3D'].map((name) => ({
         name,
         slice: chart.addSlice(name, 1),
     }))
 
     setInterval(() => {
         categories.forEach((category) => {
             const { name, slice } = category
             if (name === 'Line') {
                 slice.setValue(lineChartIncomingDataCount)
                 lineChartIncomingDataCount = 0
             } else if (name === 'Scatter') {
                 slice.setValue(scatterChartIncomingDataCount)
                 scatterChartIncomingDataCount = 0
             } else if (name === 'Spectrogram 2D') {
                 slice.setValue(heatmapChartIncomingDataCount)
                 heatmapChartIncomingDataCount = 0
             } else if (name === 'Spectrogram 3D') {
                 slice.setValue(surfaceChartIncomingDataCount)
                 surfaceChartIncomingDataCount = 0
             } else if (name === 'Box 3D') {
                 slice.setValue(boxChartIncomingDataCount)
                 boxChartIncomingDataCount = 0
             }
         })
     }, 2000)
 
     if (CONFIG.LEGENDS) {
         chart.addLegendBox(LegendBoxBuilders.HorizontalLegendBox).add(chart)
     }
 })()
 
 // #endregion
 
 // #region *** Spider ***
 ;(() => {
     const chart = dashboard
         .createSpiderChart({
             columnIndex: 2,
             rowIndex: 4,
             rowSpan: 2,
         })
         .setTitle('Animated Spider Chart | Data process time (ms)')
         .setAxisScrollStrategy(undefined)
         .setAxisInterval(10, 0)
         .setAutoCursorMode(AutoCursorModes.snapToClosest)
 
     const series = chart
         .addSeries()
         .setName('Data process time')
         .setCursorResultTableFormatter((builder, _, value, axis, formatValue) =>
             builder.addRow('Data process time').addRow(`${axis}: ${formatValue(value)} ms`),
         )
     setInterval(() => {
         series.addPoints(
             { axis: 'Line', value: lineChartDataProcessTime },
             { axis: 'Scatter', value: scatterChartDataProcessTime },
             { axis: 'Spectrogram 2D', value: heatmapChartDataProcessTime },
             { axis: 'Spectrogram 3D', value: surfaceChartDataProcessTime },
             { axis: 'Box 3D', value: boxChartDataProcessTime },
         )
         lineChartDataProcessTime = 0
         scatterChartDataProcessTime = 0
         heatmapChartDataProcessTime = 0
         surfaceChartDataProcessTime = 0
         boxChartDataProcessTime = 0
     }, 2000)
 
     if (CONFIG.LEGENDS) {
         chart.addLegendBox(LegendBoxBuilders.HorizontalLegendBox).add(chart)
     }
 })()
 
 // #endregion
 
 // #endregion
 
 const intervalCheckStart = setInterval(() => {
     if (startFunctionArray.length === 4) {
         startFunctionArray.forEach((clbk) => clbk())
         clearInterval(intervalCheckStart)
     }
 }, 500)
 