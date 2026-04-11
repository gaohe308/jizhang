const routeMap: Record<string, string> = {
  home: '/pages/index/index',
  room: '/pages/room/index',
  profile: '/pages/profile/index',
}

Component({
  properties: {
    value: {
      type: String,
      value: 'home',
    },
  },
  methods: {
    onChange(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
      const nextValue = event.detail.value
      if (nextValue === this.properties.value) {
        return
      }

      const target = routeMap[nextValue]
      if (!target) {
        return
      }

      wx.redirectTo({ url: target })
    },
  },
})
