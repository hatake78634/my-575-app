'use client'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '@/lib/supabase'

type Product = { id: string; name: string; description: string; price: number }
type ShopResult = { requestId: number; userId: string; products: Product[]; owned: string[]; balance: number; errorText: string }

export default function ShopPage() {
  const { userId, loading: authLoading } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [owned, setOwned] = useState<Set<string>>(new Set())
  const [balance, setBalance] = useState<number | null>(null)
  const [loaded, setLoaded] = useState<string | null>(null)
  const [errorText, setErrorText] = useState('')
  const [buying, setBuying] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  const load = useCallback(async (id: string): Promise<ShopResult> => {
    const requestId = ++requestIdRef.current
    const [catalog, purchases, wallet] = await Promise.all([
      supabase.from('shop_products').select('id,name,description,price').order('display_order'),
      supabase.from('shop_purchases').select('product_id').eq('user_id', id),
      supabase.rpc('ensure_my_wallet'),
    ])
    const error = catalog.error ?? purchases.error ?? wallet.error
    if (error) {
      console.error('ショップ取得エラー:', error)
      return { requestId, userId: id, products: [], owned: [], balance: 0, errorText: 'ショップを取得できませんでした。' }
    }
    return { requestId, userId: id, products: (catalog.data ?? []) as Product[], owned: (purchases.data ?? []).map((item) => item.product_id), balance: Number(wallet.data), errorText: '' }
  }, [])
  const apply = useCallback((result: ShopResult) => {
    if (result.requestId !== requestIdRef.current) return
    setProducts(result.products); setOwned(new Set(result.owned)); setBalance(result.balance); setErrorText(result.errorText); setLoaded(result.userId)
  }, [])
  const reload = useCallback(async (id: string) => apply(await load(id)), [apply, load])

  useEffect(() => { if (!authLoading && userId) void load(userId).then(apply) }, [apply, authLoading, load, userId])
  const buy = async (productId: string) => {
    if (!userId || buying) return
    setBuying(productId)
    const { data, error } = await supabase.rpc('purchase_shop_product', { p_product_id: productId })
    if (error) setErrorText(error.message)
    else { setBalance(Number(data)); await reload(userId) }
    setBuying(null)
  }
  const loading = authLoading || (!!userId && loaded !== userId)
  return <main className="app-shell" style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px 96px' }}>
    <h1 style={{ color: '#ffda79' }}>通常ショップ</h1><p>内容と価格が決まった商品のみを扱います。ランダム販売はありません。</p>
    {loading ? <p role="status">読み込み中です…</p> : !userId ? <p><Link href="/auth" style={{ color: '#ffda79' }}>ログイン</Link>が必要です。</p> : <><h2>残高: {balance ?? 0} コイン</h2>{errorText && <p role="alert" style={{ color: '#ff8d8d' }}>{errorText}</p>}<div style={{ display: 'grid', gap: 10 }}>{products.map((product) => <article key={product.id} className="panel-card" style={{ padding: 16 }}><h2>{product.name}</h2><p>{product.description}</p><button className={owned.has(product.id) ? 'soft-button' : 'gold-button'} disabled={owned.has(product.id) || buying !== null} onClick={() => buy(product.id)} style={{ padding: '9px 14px' }}>{owned.has(product.id) ? '所持済み' : `${product.price} コインで購入`}</button></article>)}</div><p><Link href="/customize" style={{ color: '#ffda79' }}>着せ替えへ →</Link></p></>}
  </main>
}
