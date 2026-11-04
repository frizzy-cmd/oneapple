export function initControls(config) {
    window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        if (e.code === 'Space') {
            e.preventDefault();
            config.playBtn.click();
        } else if (e.code === 'ArrowLeft') {
            e.preventDefault();
            config.video.currentTime = Math.max(0, config.video.currentTime - 5);
            config.renderSingleFrame();
        } else if (e.code === 'ArrowRight') {
            e.preventDefault();
            config.video.currentTime = Math.min(config.video.duration, config.video.currentTime + 5);
            config.renderSingleFrame();
        } else if (e.key.toLowerCase() === 's') {
            config.takeSnapshot();
        }
    });

    const gridButtons = document.querySelectorAll('.grid-btn');
    gridButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const newCols = parseInt(btn.dataset.cols);
            const newRows = parseInt(btn.dataset.rows);
            
            gridButtons.forEach(b => b.style.background = '#222');
            btn.style.background = '#444';
            config.changeResolution(newCols, newRows);
        });
    });
}

console.log("controls OK")

// controls and alsoh andles grid button

// if you see this, hi!
// you're smart (and beautiful and i love you)
//               ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//           bro vsc auto complete suggested this or sumn
//           guess the robots are quite sweet after all?

//clankers