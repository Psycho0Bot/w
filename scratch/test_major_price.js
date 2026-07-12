async function test() {
  const ids = ['major', 'major-2', 'major-frog'];
  for (const id of ids) {
    try {
      const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`);
      const data = await res.json();
      console.log(`${id}:`, data);
    } catch (e) {
      console.error(id, e.message);
    }
  }
}

test();
