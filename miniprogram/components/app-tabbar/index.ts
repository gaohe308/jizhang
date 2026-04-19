import { createRoom, getCurrentRoomSnapshot, setCurrentRoomSnapshot } from '../../utils/api'
import { getAuthSession } from '../../utils/auth'

const routeMap: Record<string, string> = {
  home: '/pages/index/index',
  room: '/pages/room/index',
  profile: '/pages/profile/index',
}

Component({
  data: {
    creatingRoom: false,
  },
  properties: {
    value: {
      type: String,
      value: 'home',
    },
  },
  methods: {
    navigateTo(target: string) {
      wx.redirectTo({ url: target })
    },

    async handleRoomTabChange() {
      if (this.data.creatingRoom) {
        return
      }

      const session = getAuthSession()
      if (!session?.token) {
        wx.showToast({
          title: '请先完成微信登录',
          icon: 'none',
        })
        this.navigateTo(routeMap.home)
        return
      }

      const currentRoom = getCurrentRoomSnapshot()
      if (currentRoom?.roomId) {
        this.navigateTo(routeMap.room)
        return
      }

      const confirmResult = await new Promise<boolean>((resolve) => {
        wx.showModal({
          title: '创建房间',
          content: '当前还没有进行中的房间，是否立即创建一个新的记账房间？',
          confirmText: '立即创建',
          cancelText: '稍后再说',
          success: (result) => resolve(!!result.confirm),
          fail: () => resolve(false),
        })
      })

      if (!confirmResult) {
        return
      }

      this.setData({ creatingRoom: true })

      try {
        const room = await createRoom()
        setCurrentRoomSnapshot(room)

        wx.showToast({
          title: `已创建房间 ${room.roomCode}`,
          icon: 'none',
        })

        this.navigateTo(routeMap.room)
      } catch (error) {
        wx.showToast({
          title: error instanceof Error ? error.message : '创建房间失败',
          icon: 'none',
        })
      } finally {
        this.setData({ creatingRoom: false })
      }
    },

    onChange(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
      const nextValue = event.detail.value
      if (nextValue === this.properties.value) {
        return
      }

      if (nextValue === 'room') {
        void this.handleRoomTabChange()
        return
      }

      const target = routeMap[nextValue]
      if (!target) {
        return
      }

      this.navigateTo(target)
    },
  },
})
