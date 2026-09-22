/** Opening curtain. The motion module drives the counter, bar and exit. */
export default function Preloader() {
  return (
    <div id="pre">
      <div id="pre-word">Yug Johri</div>
      <div className="pre-foot">
        <div className="pre-meta mono mono--wide">
          <span>AI engineer — Delhi, India</span>
          <span id="pre-num">00</span>
        </div>
        <div className="pre-track">
          <div id="pre-bar" />
        </div>
      </div>
    </div>
  )
}
