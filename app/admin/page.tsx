'use client'

import { useState } from 'react'
import { Upload, Trash2, LogIn, CheckCircle, AlertCircle, FileSpreadsheet } from 'lucide-react'
import Image from 'next/image'

export default function AdminPage() {
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [authed, setAuthed] = useState(false)
  const [error, setError] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)

  const authHeader = 'Basic ' + btoa(`${user}:${pass}`)

  const login = async () => {
    setError('')
    const res = await fetch('/api/haciendas', {
      headers: { authorization: authHeader }
    })
    if (res.ok) {
      setAuthed(true)
    } else {
      setError('Usuario o contraseña incorrectos')
    }
  }

  const verificarCredenciales = async () => {
    setLoading(true)
    setError('')
    try {
      // Verificamos haciendo una petición de prueba al upload con método HEAD simulado
      const formData = new FormData()
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: { authorization: authHeader },
        body: formData,
      })
      if (res.status === 401) {
        setError('Usuario o contraseña incorrectos')
      } else {
        setAuthed(true)
      }
    } catch {
      setError('Error de conexión')
    }
    setLoading(false)
  }

  const subirArchivo = async () => {
    if (!file) return
    setLoading(true)
    setMensaje(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: { authorization: authHeader },
        body: formData,
      })
      const data = await res.json()
      if (res.ok) {
        setMensaje({ tipo: 'ok', texto: `✅ Archivo subido correctamente. ${data.total} haciendas cargadas.` })
        setFile(null)
      } else {
        setMensaje({ tipo: 'error', texto: `Error: ${data.error}` })
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error al subir el archivo' })
    }
    setLoading(false)
  }

  const borrarArchivo = async () => {
    if (!confirm('¿Seguro que quieres borrar el archivo de haciendas?')) return
    setLoading(true)
    setMensaje(null)
    try {
      const res = await fetch('/api/admin/upload', {
        method: 'DELETE',
        headers: { authorization: authHeader },
      })
      if (res.ok) {
        setMensaje({ tipo: 'ok', texto: '✅ Archivo borrado correctamente.' })
      } else {
        setMensaje({ tipo: 'error', texto: 'Error al borrar el archivo' })
      }
    } catch {
      setMensaje({ tipo: 'error', texto: 'Error de conexión' })
    }
    setLoading(false)
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 w-full max-w-sm">
          <div className="flex items-center gap-3 mb-6">
            <Image src="/iconos/probabilidad.png" alt="logo" width={36} height={36} style={{ objectFit: 'contain' }} />
            <div>
              <div className="font-bold text-slate-900">Clima Cosecha</div>
              <div className="text-[0.7rem] text-slate-400">Panel Administrador</div>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="Usuario"
              value={user}
              onChange={e => setUser(e.target.value)}
              className="border border-slate-200 rounded-lg px-4 py-2.5 text-[0.88rem] outline-none focus:border-blue-500"
            />
            <input
              type="password"
              placeholder="Contraseña"
              value={pass}
              onChange={e => setPass(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && verificarCredenciales()}
              className="border border-slate-200 rounded-lg px-4 py-2.5 text-[0.88rem] outline-none focus:border-blue-500"
            />
            {error && <p className="text-red-500 text-[0.78rem]">{error}</p>}
            <button
              onClick={verificarCredenciales}
              disabled={loading}
              className="bg-blue-600 text-white rounded-lg py-2.5 font-bold text-[0.88rem] flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <LogIn size={16} /> {loading ? 'Verificando...' : 'Ingresar'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 w-full max-w-md">
        <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
          <Image src="/iconos/probabilidad.png" alt="logo" width={36} height={36} style={{ objectFit: 'contain' }} />
          <div>
            <div className="font-bold text-slate-900">Panel Administrador</div>
            <div className="text-[0.7rem] text-slate-400">Gestión de haciendas</div>
          </div>
        </div>

        {mensaje && (
          <div className={`flex items-start gap-2 p-3 rounded-lg mb-4 text-[0.82rem] ${mensaje.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
            {mensaje.tipo === 'ok' ? <CheckCircle size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
            {mensaje.texto}
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div>
            <div className="text-[0.78rem] font-bold text-slate-700 mb-2">Subir nuevo archivo Excel</div>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-6 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all">
              <FileSpreadsheet size={28} className="text-slate-400 mb-2" />
              <span className="text-[0.82rem] text-slate-500">
                {file ? file.name : 'Haz clic para seleccionar el archivo .xlsx'}
              </span>
              <input
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={e => setFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          <button
            onClick={subirArchivo}
            disabled={!file || loading}
            className="bg-blue-600 text-white rounded-lg py-2.5 font-bold text-[0.88rem] flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors disabled:opacity-40"
          >
            <Upload size={16} /> {loading ? 'Subiendo...' : 'Subir archivo'}
          </button>

          <div className="border-t border-slate-100 pt-4">
            <div className="text-[0.78rem] font-bold text-slate-700 mb-2">Zona de peligro</div>
            <button
              onClick={borrarArchivo}
              disabled={loading}
              className="w-full border border-red-200 text-red-500 rounded-lg py-2.5 font-bold text-[0.88rem] flex items-center justify-center gap-2 hover:bg-red-50 transition-colors disabled:opacity-40"
            >
              <Trash2 size={16} /> Borrar archivo actual
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
