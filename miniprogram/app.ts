import { getAuthSession } from './utils/auth'
import { getAppState } from './utils/mock'

App<IAppOption>({
  globalData: {
    authSession: null,
    authChecked: false,
  },
  onLaunch() {
    getAppState()
    this.globalData.authSession = getAuthSession()
    this.globalData.authChecked = true
  },
})
