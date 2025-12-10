import axios from 'axios'
import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { logout, setOnlineUser, setSocketConnection, setUser } from '../redux/userSlice'
import Sidebar from '../components/Sidebar'
import logo from '../assets/logo.png'
import { io } from 'socket.io-client'  // prefer named import

const Home = () => {
  const user = useSelector(state => state.user)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()

  // choose backend host/port correctly and early
  const backendUrl = window.location.hostname === 'localhost'
    ? 'http://localhost:8080'
    : 'http://192.168.49.2:8080'

  console.log('user', user)

  const fetchUserDetails = async () => {
    const token = localStorage.getItem('token')
    try {
      const URL = `${backendUrl}/api/user-details`
      const response = await axios({
        url: URL,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        withCredentials: true,
      })

      dispatch(setUser(response.data.data))

      if (response.data.data?.logout) {
        dispatch(logout())
        navigate('/email')
      }
      console.log('current user Details', response.data)
    } catch (error) {
      console.error('fetchUserDetails error', error?.response || error)
    }
  }

  useEffect(() => {
    fetchUserDetails()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /*** socket connection */
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      console.warn('No token found — not connecting socket')
      return
    }

    const socketConnection = io(backendUrl, {
      auth: { token },
      withCredentials: true,
      // optional: tune reconnection for dev
      reconnectionAttempts: 5,
      transports: ['websocket', 'polling']
    })

    // connection lifecycle logging
    socketConnection.on('connect', () => {
      console.log('socket connected', socketConnection.id)
      // only set the socket in redux once connected
      dispatch(setSocketConnection(socketConnection))
    })

    socketConnection.on('connect_error', (err) => {
      console.error('socket connect_error', err.message || err)
    })

    socketConnection.on('disconnect', (reason) => {
      console.log('socket disconnected', reason)
    })

    socketConnection.on('onlineUser', (data) => {
      console.log('onlineUser', data)
      dispatch(setOnlineUser(data))
    })

    // helpful server-side debug events
    socketConnection.on('error', (msg) => {
      console.warn('socket error event:', msg)
    })

    return () => {
      try {
        socketConnection.disconnect()
      } catch (e) { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const basePath = location.pathname === '/'

  return (
    <div className='grid lg:grid-cols-[300px,1fr] h-screen max-h-screen'>
      <section className={`bg-white ${!basePath && 'hidden'} lg:block`}>
        <Sidebar />
      </section>

      {/**message component**/}
      <section className={`${basePath && 'hidden'}`}>
        <Outlet />
      </section>

      <div className={`justify-center items-center flex-col gap-2 hidden ${!basePath ? 'hidden' : 'lg:flex'}`}>
        <div>
          <img src={logo} width={250} alt='logo' />
        </div>
        <p className='text-lg mt-2 text-slate-500'>Select user to send message</p>
      </div>
    </div>
  )
}

export default Home
