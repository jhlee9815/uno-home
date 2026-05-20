import './index.css'
import { Icon } from './components/Icon'
import { Badge } from './components/Badge'
import { Avatar } from './components/Avatar'
import { Button } from './components/Button'
import { Input } from './components/Input'
import { OTPGroup } from './components/OTPGroup'
import { ListItem } from './compositions/ListItem'
import { Header } from './compositions/Header'
import { TabNavigation } from './compositions/TabNavigation'
import { BottomNavBar } from './compositions/BottomNavBar'
import { ContextMenu } from './compositions/ContextMenu'
import { NotificationListItem } from './compositions/NotificationListItem'
import { Modal } from './compositions/Modal'
import { SplashScreen } from './screens/SplashScreen'
import { HomeScreen } from './screens/HomeScreen'
import { FamilyScreen } from './screens/FamilyScreen'
import { CreateGroupScreen } from './screens/CreateGroupScreen'
import { ManageMembersScreen } from './screens/ManageMembersScreen'
import { HomeHubModalScreen } from './screens/HomeHubModalScreen'
import { SuccessModalScreen } from './screens/SuccessModalScreen'
import { NotificationsScreen } from './screens/NotificationsScreen'
import { EnterPasscodeScreen } from './screens/EnterPasscodeScreen'
import { ChooseHubScreen } from './screens/ChooseHubScreen'
import { HomeHubToastScreen } from './screens/HomeHubToastScreen'
import { AppleDemoScreen } from './screens/AppleDemoScreen'

function Section({ title }: { title: string }) {
  return (
    <h2 style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: 700, margin: '0 0 20px' }}>
      {title}
    </h2>
  )
}

function Divider() {
  return <div style={{ width: '100%', height: '1px', background: 'var(--border-default)', margin: '40px 0' }} />
}

function Label({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: '11px', color: 'var(--text-disabled)', margin: '0 0 8px' }}>{children}</p>
}

export default function App() {
  return (
    <div style={{ padding: '40px', fontFamily: 'var(--font-sans)', background: 'var(--background-secondary)', minHeight: '100vh' }}>

      {/* ── Icon ── */}
      <Section title="Icon" />
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <Icon name="Home" />
        <Icon name="Bell" />
        <Icon name="BellDot" />
        <Icon name="Settings" />
        <Icon name="User" />
        <Icon name="UserPlus" />
        <Icon name="Users" />
        <Icon name="Heart" />
        <Icon name="Play" />
        <Icon name="Plus" />
        <Icon name="Check" />
        <Icon name="CircleCheck" />
        <Icon name="CircleAlert" />
        <Icon name="Trash2" />
        <Icon name="X" />
        <Icon name="ArrowLeft" />
        <Icon name="MoreVertical" />
        <Icon name="Moon" />
        <Icon name="Activity" />
        <Icon name="Podcast" />
        <Icon name="ChevronDown" />
      </div>

      <Divider />

      {/* ── Badge ── */}
      <Section title="Badge" />
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <div><Label>ADMIN</Label><Badge variant="admin" /></div>
        <div><Label>MEMBER</Label><Badge variant="member" /></div>
        <div><Label>OWNER</Label><Badge variant="owner" /></div>
      </div>

      <Divider />

      {/* ── Avatar ── */}
      <Section title="Avatar" />
      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-end' }}>
        <div><Label>SM · Default</Label><Avatar size="sm" state="default" initials="JL" /></div>
        <div><Label>MD · Default</Label><Avatar size="md" state="default" initials="JL" /></div>
        <div><Label>LG · Default</Label><Avatar size="lg" state="default" initials="JL" /></div>
        <div><Label>SM · Active</Label><Avatar size="sm" state="active" initials="JL" /></div>
        <div><Label>MD · Active</Label><Avatar size="md" state="active" initials="JL" /></div>
        <div><Label>LG · Active</Label><Avatar size="lg" state="active" initials="JL" /></div>
      </div>

      <Divider />

      {/* ── Button ── */}
      <Section title="Button" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div><Label>Primary · LG</Label><Button variant="primary" size="lg" label="확인" /></div>
        <div><Label>Primary · MD</Label><Button variant="primary" size="md" label="확인" /></div>
        <div><Label>Secondary · LG</Label><Button variant="secondary" size="lg" label="취소" /></div>
        <div><Label>Danger · LG</Label><Button variant="danger" size="lg" label="삭제" /></div>
        <div><Label>Ghost · LG</Label><Button variant="ghost" size="lg" label="비활성화" /></div>
      </div>

      <Divider />

      {/* ── Input ── */}
      <Section title="Input" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div><Label>Default</Label><Input placeholder="그룹 이름을 입력하세요" /></div>
        <div><Label>With Label</Label><Input label="그룹 이름" placeholder="그룹 이름을 입력하세요" /></div>
        <div><Label>Helper Text</Label><Input label="그룹 이름" placeholder="그룹 이름을 입력하세요" helperText="그룹 이름을 입력하세요" /></div>
        <div><Label>Error</Label><Input state="error" label="그룹 이름" placeholder="그룹 이름을 입력하세요" helperText="이미 사용 중인 이름입니다" /></div>
        <div><Label>Disabled</Label><Input disabled label="그룹 이름" placeholder="그룹 이름을 입력하세요" /></div>
      </div>

      <Divider />

      {/* ── OTP Group ── */}
      <Section title="OTP Group" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <div>
          <Label>라벨 ON · 타이머 ON · sub text ON (Success)</Label>
          <OTPGroup showLabel showTimer showSubText subText="인증이 완료되었습니다" cellState="filled" />
        </div>
        <div>
          <Label>라벨 ON · 타이머 ON · sub text ON (Error)</Label>
          <OTPGroup showLabel showTimer showSubText subText="인증 코드가 올바르지 않습니다" cellState="error" />
        </div>
        <div>
          <Label>라벨 OFF · 타이머 OFF · sub text OFF (Empty)</Label>
          <OTPGroup showLabel={false} showTimer={false} showSubText={false} cellState="empty" cells={['', '', '', '', '', '']} />
        </div>
        <div>
          <Label>라벨 ON · 타이머 OFF · sub text OFF (Focused)</Label>
          <OTPGroup showLabel showTimer={false} showSubText={false} cellState="focused" cells={['', '', '', '', '', '']} />
        </div>
        <div>
          <Label>Error+Focused</Label>
          <OTPGroup showLabel showTimer showSubText subText="인증 코드가 올바르지 않습니다" cellState="error+focused" cells={['4', '8', '2', '1', '9', '2']} />
        </div>
      </div>

      <Divider />

      {/* ── Phase 3: ListItem ── */}
      <Section title="ListItem / Member" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '390px' }}>
        <div><Label>Default</Label>
          <ListItem state="Default" name="Kim Juhee" email="juhee@example.com" badge="member" initials="KJ" />
        </div>
        <div><Label>Selected</Label>
          <ListItem state="Selected" name="Park Minjun" email="minjun@example.com" badge="admin" initials="PM" />
        </div>
        <div><Label>SwipeDelete</Label>
          <ListItem state="SwipeDelete" name="Lee Soyeon" email="soyeon@example.com" badge="owner" initials="LS" />
        </div>
      </div>

      <Divider />

      {/* ── Phase 3: Header ── */}
      <Section title="Header" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div><Label>BackTitle (Family Management)</Label>
          <Header variant="BackTitle" title="Family Management" />
        </div>
        <div><Label>TitleActions (Home)</Label>
          <Header variant="TitleActions" title="UNO HOME" />
        </div>
        <div><Label>BackTitleNoAction (Create Group)</Label>
          <Header variant="BackTitleNoAction" title="Create Group" />
        </div>
      </div>

      <Divider />

      {/* ── Phase 3: TabNavigation ── */}
      <Section title="TabNavigation" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div><Label>Active: All</Label>
          <TabNavigation activeTab="All" />
        </div>
        <div><Label>Active: My Family</Label>
          <TabNavigation activeTab="My Family" />
        </div>
        <div><Label>Active: Guests</Label>
          <TabNavigation activeTab="Guests" />
        </div>
      </div>

      <Divider />

      {/* ── Phase 3: BottomNavBar ── */}
      <Section title="BottomNavBar" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div><Label>Active: Home</Label>
          <BottomNavBar activeTab="Home" />
        </div>
        <div><Label>Active: Activity</Label>
          <BottomNavBar activeTab="Activity" />
        </div>
        <div><Label>Active: Moon</Label>
          <BottomNavBar activeTab="Moon" />
        </div>
      </div>

      <Divider />

      {/* ── Phase 3: ContextMenu ── */}
      <Section title="ContextMenu" />
      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        <ContextMenu />
      </div>

      <Divider />

      {/* ── Phase 3: NotificationListItem ── */}
      <Section title="NotificationListItem" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div><Label>actions</Label>
          <NotificationListItem
            variant="actions"
            title="Group Invitation"
            time="2 mins ago"
            subtext="Invited by mom@gmail.com to join Mom's House"
          />
        </div>
        <div><Label>confirmed</Label>
          <NotificationListItem
            variant="confirmed"
            title="Group Invitation"
            time="1 hr ago"
            subtext="Invited by mom@gmail.com to join Mom's House"
          />
        </div>
        <div><Label>status-text</Label>
          <NotificationListItem
            variant="status-text"
            title="Group Invitation"
            time="2 hr ago"
            subtext="Invited by mom@gmail.com to join Mom's House"
            statusText="Invitation declined"
          />
        </div>
        <div><Label>none</Label>
          <NotificationListItem
            variant="none"
            title="Group Invitation"
            time="1 day ago"
            subtext="Invited by mom@gmail.com to join Mom's House"
          />
        </div>
      </div>

      <Divider />

      {/* ── Phase 3: Modal ── */}
      <Section title="Modal" />
      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div><Label>Success</Label>
          <Modal type="Success" title="Successfully Joined!" description="You have joined the family hub." />
        </div>
        <div><Label>Danger</Label>
          <Modal type="Danger" title="Delete Member?" description="This will remove the member from the hub." />
        </div>
      </div>

      <Divider />

      {/* ── Phase 4: Screens ── */}
      <Section title="Phase 4 — Screens" />

      <Divider />

      <Section title="Screen 1: SplashScreen" />
      <div style={{ width: '390px', border: '1px solid var(--border-default)', borderRadius: '24px', overflow: 'hidden' }}>
        <SplashScreen />
      </div>

      <Divider />

      <Section title="Screen 2: HomeScreen" />
      <div style={{ width: '390px', border: '1px solid var(--border-default)', borderRadius: '24px', overflow: 'hidden' }}>
        <HomeScreen />
      </div>

      <Divider />

      <Section title="Screen 3: FamilyScreen" />
      <div style={{ width: '390px', border: '1px solid var(--border-default)', borderRadius: '24px', overflow: 'hidden' }}>
        <FamilyScreen />
      </div>

      <Divider />

      <Section title="Screen 4: CreateGroupScreen" />
      <div style={{ width: '390px', border: '1px solid var(--border-default)', borderRadius: '24px', overflow: 'hidden' }}>
        <CreateGroupScreen />
      </div>

      <Divider />

      <Section title="Screen 5: ManageMembersScreen" />
      <div style={{ width: '390px', border: '1px solid var(--border-default)', borderRadius: '24px', overflow: 'hidden' }}>
        <ManageMembersScreen />
      </div>

      <Divider />

      <Section title="Screen 6: HomeHubModalScreen" />
      <div style={{ width: '390px', border: '1px solid var(--border-default)', borderRadius: '24px', overflow: 'hidden' }}>
        <HomeHubModalScreen />
      </div>

      <Divider />

      <Section title="Screen 7: SuccessModalScreen" />
      <div style={{ width: '390px', border: '1px solid var(--border-default)', borderRadius: '24px', overflow: 'hidden' }}>
        <SuccessModalScreen />
      </div>

      <Divider />

      <Section title="Screen 8: NotificationsScreen" />
      <div style={{ width: '390px', border: '1px solid var(--border-default)', borderRadius: '24px', overflow: 'hidden' }}>
        <NotificationsScreen />
      </div>

      <Divider />

      {/* ── Phase 5: New Screens ── */}
      <Section title="Phase 5 — New Screens (Pixel-Perfect)" />

      <Divider />

      <Section title="Screen A: SplashScreen (Figma 0:3823)" />
      <div style={{ width: '390px', border: '1px solid var(--border-default)', borderRadius: '24px', overflow: 'hidden' }}>
        <SplashScreen />
      </div>

      <Divider />

      <Section title="Screen B: Enter Passcode — Empty (Figma 0:8196)" />
      <div style={{ width: '390px', border: '1px solid var(--border-default)', borderRadius: '24px', overflow: 'hidden' }}>
        <EnterPasscodeScreen variant="empty" />
      </div>

      <Divider />

      <Section title="Screen C: Enter Passcode — Filled (Figma 0:8238)" />
      <div style={{ width: '390px', border: '1px solid var(--border-default)', borderRadius: '24px', overflow: 'hidden' }}>
        <EnterPasscodeScreen variant="filled" />
      </div>

      <Divider />

      <Section title="Screen D: Enter Passcode — Error (Figma 0:8280)" />
      <div style={{ width: '390px', border: '1px solid var(--border-default)', borderRadius: '24px', overflow: 'hidden' }}>
        <EnterPasscodeScreen variant="error" />
      </div>

      <Divider />

      <Section title="Screen E: Choose Home Hub (Figma 0:8044)" />
      <div style={{ width: '390px', border: '1px solid var(--border-default)', borderRadius: '24px', overflow: 'hidden' }}>
        <ChooseHubScreen />
      </div>

      <Divider />

      <Section title="Screen F: Home Hub + Toast (Figma 0:8379)" />
      <div style={{ width: '390px', border: '1px solid var(--border-default)', borderRadius: '24px', overflow: 'hidden' }}>
        <HomeHubToastScreen />
      </div>

      <Divider />

      {/* ── Phase 4 (Apple-inspired adapter): Demo ── */}
      <Section title="Phase 4 — Apple-inspired Adapter Demo" />
      <div style={{
        width: '780px',
        maxWidth: '100%',
        border: '1px solid var(--border-default)',
        borderRadius: '24px',
        overflow: 'hidden',
      }}>
        <AppleDemoScreen />
      </div>

    </div>
  )
}
