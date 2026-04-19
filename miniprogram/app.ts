import { getAuthSession } from './utils/auth'
import { getApiBaseUrl, getApiBaseUrlCandidates, getMiniProgramEnvVersion } from './utils/env'

App<IAppOption>({
  globalData: {
    authSession: null,
    authChecked: false,
  },
  onLaunch() {
    this.globalData.authSession = getAuthSession()
    this.globalData.authChecked = true
    console.info('[app] API base url candidates', getApiBaseUrlCandidates())

    console.info('[app] 当前环境', getMiniProgramEnvVersion())
    console.info('[app] 当前接口地址', getApiBaseUrl())
  },
})
