/* globals customElements */
import { LitElement, html, css } from '../vendor/lit-element/lit-element'
import { classMap } from '../vendor/lit-element/lit-html/directives/class-map'
import prettyHash from 'pretty-hash'
import * as bg from './bg-process-rpc'
import commonCSS from './common.css'
import inputsCSS from './inputs.css'
import buttonsCSS from './buttons.css'
import spinnerCSS from './spinner.css'

const STATES = {
  READY: 0,
  DOWNLOADING: 1,
  CLONING: 2
}

class ForkDriveModal extends LitElement {
  static get properties () {
    return {
      state: {type: Number},
      label: {type: String}
    }
  }

  static get styles () {
    return [commonCSS, inputsCSS, buttonsCSS, spinnerCSS, css`
    .wrapper {
      padding: 0;
    }
    
    h1.title {
      padding: 14px 20px;
      margin: 0;
      border-color: #bbb;
    }
    
    form {
      padding: 14px 20px;
      margin: 0;
    }

    input {
      font-size: 14px;
      height: 34px;
      padding: 0 10px;
      border-color: #bbb;
    }

    .help {
      margin-top: -8px;
      opacity: 0.6;
    }
    
    hr {
      border: 0;
      border-top: 1px solid #ddd;
      margin: 20px 0;
    }

    .form-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .fork-dat-progress {
      font-size: 14px;
    }
    `]
  }

  constructor () {
    super()

    // internal state
    this.driveInfo = null
    this.state = STATES.READY

    // params
    this.cbs = null
    this.url = ''
    this.label = ''
  }

  async init (params, cbs) {
    // store params
    this.cbs = cbs
    this.url = params.url
    this.label = params.label || ''
    await this.requestUpdate()

    // fetch drive info
    this.url = await bg.hyperdrive.resolveName(params.url)
    this.driveInfo = await bg.hyperdrive.getInfo(this.url)
    await this.requestUpdate()
    this.adjustHeight()
  }

  adjustHeight () {
    var height = this.shadowRoot.querySelector('div').clientHeight
    bg.modals.resizeSelf({height})
  }

  // rendering
  // =

  render () {
    if (!this.driveInfo) {
      return this.renderLoading()
    }

    var progressEl
    var actionBtn
    switch (this.state) {
      case STATES.READY:
        progressEl = html`<div class="fork-dat-progress">Ready to fork.</div>`
        actionBtn = html`<button type="submit" class="btn primary" tabindex="5">Create fork</button>`
        break
      case STATES.DOWNLOADING:
        progressEl = html`<div class="fork-dat-progress">Downloading remaining files...</div>`
        actionBtn = html`<button type="submit" class="btn" disabled tabindex="5"><span class="spinner"></span></button>`
        break
      case STATES.CLONING:
        progressEl = html`<div class="fork-dat-progress">Copying...</div>`
        actionBtn = html`<button type="submit" class="btn" disabled tabindex="5"><span class="spinner"></span></button>`
        break
    }

    return html`
      <link rel="stylesheet" href="beaker://assets/font-awesome.css">
      <div class="wrapper">
        <h1 class="title">Make a Fork of ${this.driveInfo.title ? `"${this.driveInfo.title}"` : prettyHash(this.driveInfo.key)}</h1>

        <form @submit=${this.onSubmit}>
          <label for="label">Label</label>
          <input name="label" tabindex="1" value="${this.label}" @change=${this.onChangeLabel} placeholder="E.g. 'dev' or 'my-new-feature'" required autofocus />
          <p class="help">The label will be used privately to help you identify the fork.</p>
          
          <hr>

          <div class="form-actions">
            ${progressEl}
            <div>
              <button type="button" class="btn cancel" @click=${this.onClickCancel} tabindex="4">Cancel</button>
              ${actionBtn}
            </div>
          </div>
        </form>
      </div>
    `
  }

  renderLoading () {
    return html`
      <div class="wrapper">
        <h1 class="title">Make a Fork</h1>
        <p class="help-text">Loading...</p>
        <form>
          <label for="label">Label</label>
          <input name="label" tabindex="1" value="${this.label}" @change=${this.onChangeLabel} placeholder="E.g. 'dev' or 'my-new-feature'" required />
          <p class="help">The label will be used privately to help you identify the fork.</p>

          <hr>

          <div class="form-actions">
            <div></div>
            <div>
              <button type="button" class="btn cancel" @click=${this.onClickCancel} tabindex="4">Cancel</button>
              <button type="submit" class="btn" tabindex="5" disabled>Create fork</button>
            </div>
          </div>
        </form>
      </div>
    `
  }

  // event handlers
  // =

  onChangeLabel (e) {
    this.label = e.target.value
  }

  onClickCancel (e) {
    e.preventDefault()
    this.cbs.reject(new Error('Canceled'))
  }

  async onSubmit (e) {
    e.preventDefault()

    if (!this.label) {
      return
    }

    this.state = STATES.DOWNLOADING
    await bg.hyperdrive.download(this.url)

    this.state = STATES.CLONING
    try {
      var url = await bg.hyperdrive.forkDrive(this.url, {
        label: this.label,
        prompt: false
      })
      this.cbs.resolve({url})
    } catch (e) {
      this.cbs.reject(e.message || e.toString())
    }
  }
}

customElements.define('fork-drive-modal', ForkDriveModal)