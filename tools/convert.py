# Convertit un réseau Maia (format Leela .pb.gz, LINEAR16) en un fichier binaire compact
# lisible directement en JavaScript :
#   [uint32 longueur JSON][JSON d'en-tête][alignement][données uint16 de chaque couche]
# Chaque couche garde sa quantification d'origine (min, max) : valeur = min + q/65535*(max-min).
import gzip, json, struct, sys
import net_pb2

def layers(w):
    out = []
    def add(name, l):
        if len(l.params):
            out.append((name, l))
    def conv(prefix, c):
        for k in ('weights', 'biases', 'bn_means', 'bn_stddivs', 'bn_gammas', 'bn_betas'):
            if c.HasField(k): add(f'{prefix}.{k}', getattr(c, k))
    conv('input', w.input)
    for i, r in enumerate(w.residual):
        conv(f'res{i}.conv1', r.conv1)
        conv(f'res{i}.conv2', r.conv2)
        for k in ('w1', 'b1', 'w2', 'b2'):
            add(f'res{i}.se.{k}', getattr(r.se, k))
    conv('policy1', w.policy1)
    conv('policy', w.policy)
    conv('value', w.value)
    for k in ('ip1_val_w', 'ip1_val_b', 'ip2_val_w', 'ip2_val_b'):
        add(k, getattr(w, k))
    return out

def main(src, dst):
    n = net_pb2.Net()
    n.ParseFromString(gzip.open(src).read())
    assert n.format.weights_encoding == net_pb2.Format.LINEAR16
    ls = layers(n.weights)
    header = {'blocks': len(n.weights.residual), 'filters': 64, 'layers': []}
    off = 0
    blobs = []
    for name, l in ls:
        cnt = len(l.params) // 2
        header['layers'].append({'name': name, 'count': cnt, 'min': l.min_val, 'max': l.max_val, 'offset': off})
        blobs.append(l.params)
        off += cnt
    hj = json.dumps(header).encode()
    pad = (4 + len(hj)) % 2
    with open(dst, 'wb') as f:
        f.write(struct.pack('<I', len(hj) + pad))
        f.write(hj + b' ' * pad)
        for b in blobs:
            f.write(b)
    print(dst, len(ls), 'couches', off, 'paramètres')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
