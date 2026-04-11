import { getAppState } from './utils/mock'

App<IAppOption>({
  globalData: {},
  onLaunch() {
    getAppState()
  },
})
