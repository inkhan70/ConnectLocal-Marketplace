function SearchResultsContent() {
    const searchParams = useSearchParams();
    const { t } = useLanguage();
    const searchTerm = searchParams.get('q') || '';
    const city = searchParams.get('city') || '';
    const maxDistanceParam = searchParams.get('maxDistance') || '100';
    const minPriceParam = searchParams.get('minPrice');
    const maxPriceParam = searchParams.get('maxPrice');
    const firestore = useFirestore();
    const [userLocation, setUserLocation] = useState<LocationData | null>(null);
    
    // Note: To make search case-insensitive, store a 'name_lowercase' field in your 
    // documents, convert searchTerm to lowercase here, and query against that field.
    const productsQuery = useMemoFirebase(() => {
        if (!searchTerm) return null;
        return query(collection(firestore, 'products'), 
            where('name', '>=', searchTerm),
            where('name', '<=', searchTerm + '\uf8ff')
        );
    }, [firestore, searchTerm]);
    
    const businessesQuery = useMemoFirebase(() => {
        const businessRoles = ["company", "wholesaler", "distributor", "shopkeeper"];
        const usersCollection = collection(firestore, 'users');
        let q = query(usersCollection, where('role', 'in', businessRoles));

        const nameFilter = searchTerm ? [where('businessName', '>=', searchTerm), where('businessName', '<=', searchTerm + '\uf8ff')] : [];
        const cityFilter = city ? [where('city', '==', city)] : [];
        const allFilters = [...nameFilter, ...cityFilter];

        if (allFilters.length === 0) return null; 
        
        // This query requires a Composite Index in the Firebase Console if both filters are active
        return query(q, ...allFilters);
    }, [firestore, searchTerm, city]);

    const { data: productResults, isLoading: productsLoading } = useCollection<Product>(productsQuery);
    const { data: businessResults, isLoading: businessesLoading } = useCollection<UserProfile>(businessesQuery);
    const [combinedResults, setCombinedResults] = useState<SearchResult[]>([]);
    
    useEffect(() => {
        const loadLocation = async () => {
            const cached = getCachedLocation(30);
            if (cached) {
                setUserLocation(cached);
                return;
            }
            const location = await getUserLocation();
            if (location) {
                cacheLocation(location);
                setUserLocation(location);
            }
        };
        loadLocation();
    }, []);
    
    useEffect(() => {
        const results: SearchResult[] = [];
        const maxDistance = parseInt(maxDistanceParam) || 100;
        const minPrice = minPriceParam ? parseFloat(minPriceParam) : null;
        const maxPrice = maxPriceParam ? parseFloat(maxPriceParam) : null;
        
        if (productResults) { 
            let filtered = productResults;
            
            // FIX: If a city is queried, filter products to only show those belonging 
            // to businesses located in that city (using our loaded businessResults)
            if (city && businessResults) {
                const cityBusinessUids = new Set(businessResults.map(b => b.uid));
                filtered = filtered.filter(p => p.userId && cityBusinessUids.has(p.userId));
            }
            
            // Filter by price if specified
            if (minPrice !== null || maxPrice !== null) {
                filtered = filtered.filter(p => {
                    const minVarietyPrice = Math.min(...(p.varieties?.map(v => v.price) || [Infinity]));
                    if (minPrice !== null && minVarietyPrice < minPrice) return false;
                    if (maxPrice !== null && minVarietyPrice > maxPrice) return false;
                    return true;
                });
            }
            
            results.push(...filtered.map(p => ({ type: 'product' as const, data: p })));
        }
        
        if (businessResults) {
            let filtered = businessResults;
            
            // Filter by distance if location is available
            if (userLocation) {
                const { latitude, longitude } = userLocation.coordinates;
                filtered = filtered.map(b => ({
                    ...b,
                    distance: calculateDistance(latitude, longitude, b.latitude || 0, b.longitude || 0)
                })).filter(b => b.distance <= maxDistance);
            }
            
            results.push(...filtered.map(b => ({ type: 'business' as const, data: b })));
        }
        
        setCombinedResults(results);
    }, [productResults, businessResults, city, userLocation, maxDistanceParam, minPriceParam, maxPriceParam]);
    
    const isLoading = productsLoading || businessesLoading;

    const getTitle = () => {
        if (searchTerm && city) return `"${searchTerm}" in ${city}`;
        if (searchTerm) return `"${searchTerm}"`;
        if (city) return `Businesses in ${city}`;
        return "All Results";
    }

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="ml-4">Searching...</p>
            </div>
        );
    }

    // ... Keep original JSX return unchanged ...
